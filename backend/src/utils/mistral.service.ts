import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

interface EnrichedRecipeIngredientDTO {
  ingredientID: number;
  quantity: number;
  unitID: number;
  name: string;
  unitType: string;
}

interface CreateRecipeIngredientDTO {
  ingredientID: number;
  quantity: number;
  unitID: number;
}

interface CreateStepDTO {
  text: string;
  order: number;
}

interface CreateRecipeDTO {
  name: string;
  portions: number;
  prepTime: number;
  cookTime: number;
  steps: CreateStepDTO[];
  recipeIngredients: (CreateRecipeIngredientDTO | EnrichedRecipeIngredientDTO)[];
  categories: string[];
  description?: string;
  photoUri?: string;
}

export interface RecipeExtractionResult {
  recipe: Partial<CreateRecipeDTO>;
  confidence: number;
  missingFields: string[];
}

@Injectable()
export class MistralService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.mistral.ai/v1';

  constructor(
    private configService: ConfigService,
    private prismaService: PrismaService,
  ) {
    this.apiKey = this.configService.get<string>('MISTRAL_API_KEY')!;
    if (!this.apiKey) {
      throw new Error('MISTRAL_API_KEY environment variable is not set');
    }
  }

  /**
   * Analyse une transcription pour extraire les informations de recette
   */
  async extractRecipeInfo(
    transcript: string,
    keywords: string[] = []
  ): Promise<RecipeExtractionResult> {
    try {
      const prompt = this.buildExtractionPrompt(transcript, keywords);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mistral-large-latest',
          messages: [
            {
              role: 'system',
              content: `Tu es un assistant culinaire expert. Analyse la transcription d'une recette dictée et extrait les informations structurées.

INSTRUCTIONS IMPORTANTES:
- Si le nom de la recette n'est pas mentionné, invente un nom accrocheur basé sur les ingrédients principaux
- Génère toujours une courte description (2-3 phrases) même si elle n'est pas mentionnée
- Pour les portions : si pas mentionné, estime 4 personnes par défaut
- Pour les temps : si pas mentionné, estime raisonnablement (préparation 15-30min, cuisson selon le type de plat)
- Pour les ingrédients : liste uniquement ceux qui sont explicitement mentionnés dans la transcription, avec quantités et unités non nulles
- Ne rajoute pas d'ingrédients supplémentaires qui ne sont pas clairement indiqués dans le texte dicté
- Pour chaque ingrédient : quantity ne doit jamais être null, unit ne doit jamais être null
- Utilise uniquement ces unités autorisées : g, mL, unité, kg, mg, cL, L, pièce, tranche, tranches, gousse, branche, feuille, pincée, poignée, c. à c., c. à s., sachet, bouquet
- Pour les étapes : décompose en étapes logiques numérotées
- Sois créatif mais réaliste dans tes estimations

FORMAT DE RÉPONSE JSON STRICT:
{
  "name": "Nom de la recette",
  "portions": nombre,
  "prepTime": minutes,
  "cookTime": minutes,
  "description": "Courte description",
  "ingredients": [
    {"name": "nom ingrédient", "quantity": quantité, "unit": "unité"},
    ...
  ],
  "steps": [
    {"description": "Étape 1", "order": 1},
    {"description": "Étape 2", "order": 2},
    ...
  ],
  "categories": ["catégorie1", "catégorie2"],
  "confidence": 0.0-1.0,
  "missingFields": ["champ1", "champ2"]
}`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        throw new Error(`Mistral API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('🔎 Mistral raw response:', JSON.stringify(data, null, 2));
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content received from Mistral API');
      }

      // Parser le JSON de la réponse
      const parsedResult = await this.parseMistralResponse(content);

      return parsedResult;
    } catch (error) {
      console.error('Mistral extraction error:', error);
      throw error;
    }
  }

  /**
   * Construit le prompt pour l'extraction
   */
  private buildExtractionPrompt(transcript: string, keywords: string[]): string {
    const keywordsStr = keywords.length > 0 ? `Mots-clés détectés: ${keywords.join(', ')}` : '';

    return `Analyse cette transcription de recette dictée et extrait toutes les informations pertinentes:

TRANSCRIPTION:
"${transcript}"

${keywordsStr}

Extrait les informations suivantes au format JSON spécifié dans les instructions système:
- Nom de la recette (invente si nécessaire)
- Nombre de portions (estime si pas mentionné)
- Temps de préparation et cuisson (estime si pas mentionné)
- Description courte (génère toujours)
- Liste des ingrédients avec quantités et unités non nulles
- Étapes de préparation détaillées
- Catégories appropriées

Important : quantity ne doit jamais être null, unit ne doit jamais être null, utilise uniquement les unités autorisées.

Sois créatif et logique dans tes estimations!`;
  }

  /**
   * Parse la réponse JSON de Mistral
   */
  private async parseMistralResponse(content: string): Promise<RecipeExtractionResult> {
    try {
      // Nettoyer la réponse (enlever les ```json si présents)
      const cleanContent = content.replace(/```json\s*|\s*```/g, '').trim();

      const parsed = JSON.parse(cleanContent);

      // Validation et transformation des données
      const recipe: Partial<CreateRecipeDTO> = {
        name: parsed.name || 'Recette sans nom',
        portions: Number(parsed.portions) || 4,
        prepTime: Number(parsed.prepTime) || 15,
        cookTime: Number(parsed.cookTime) || 30,
        description: parsed.description || 'Une délicieuse recette créée par dictée vocale',
        recipeIngredients: await this.transformIngredients(parsed.ingredients || []),
        steps: this.transformSteps(parsed.steps || []),
        categories: parsed.categories || [],
      };

      return {
        recipe,
        confidence: Number(parsed.confidence) || 0.8,
        missingFields: parsed.missingFields || [],
      };
    } catch (error) {
      console.error('Failed to parse Mistral response:', error);
      console.error('Raw content:', content);

      // Fallback en cas d'erreur de parsing
      return {
        recipe: {
          name: 'Recette extraite',
          portions: 4,
          prepTime: 15,
          cookTime: 30,
          description: 'Recette créée par dictée vocale',
          recipeIngredients: [],
          steps: [{ text: 'Suivez les instructions de la transcription', order: 1 }],
          categories: [],
        },
        confidence: 0.5,
        missingFields: ['parsing_error'],
      };
    }
  }

  /**
   * Transforme les ingrédients du format Mistral vers CreateRecipeIngredientDTO
   */
  private normalizeUnit(unit: string | undefined): string {
    const allowed = [
      'g', 'ml', 'unité', 'kg', 'mg', 'cl', 'cL', 'l', 'L', 'pièce', 'tranche', 'tranches',
      'gousse', 'branche', 'feuille', 'pincée', 'poignée', 'c. à c.', 'c. à s.', 'sachet', 'bouquet',
      'c.à c.', 'c.à s.', 'cuillère à café', 'cuillère à soupe'
    ];

    if (!unit || typeof unit !== 'string') {
      return 'unité';
    }

    const normalized = unit
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/cuillère(s?) à café|c\.?\s?à\s?c\.?/g, 'c. à c.')
      .replace(/cuillère(s?) à soupe|c\.?\s?à\s?s\.?/g, 'c. à s.')
      .replace(/litre(s?)$/, 'L')
      .replace(/centilitre(s?)$/, 'cL')
      .replace(/millilitre(s?)$/, 'mL')
      .replace(/gramme(s?)$/, 'g')
      .replace(/kilogramme(s?)$/, 'kg')
      .replace(/milligramme(s?)$/, 'mg');

    const match = allowed.find((u) => u.toLowerCase() === normalized.toLowerCase());
    return match || 'unité';
  }

  private async transformIngredients(ingredients: any[]): Promise<EnrichedRecipeIngredientDTO[]> {
    const result: EnrichedRecipeIngredientDTO[] = [];

    for (const ing of ingredients) {
      const ingredientName = typeof ing.name === 'string' && ing.name.trim() ? ing.name.trim() : null;
      
      if (!ingredientName) {
        console.warn('Ingrédient sans nom ignoré:', ing);
        continue;
      }

      try {
        const dbIngredient = await this.findIngredientMatch(ingredientName);

        if (!dbIngredient) {
          console.warn(`Ingrédient "${ingredientName}" non trouvé dans la BD après recherche floue, ignoré`);
          continue;
        }

        // Normaliser l'unité
        const normalizedUnit = this.normalizeUnit(ing.unit);

        // Chercher l'unitID
        const unitRecord = await this.prismaService.unit.findFirst({
          where: {
            type: normalizedUnit,
          },
        });

        if (!unitRecord) {
          console.warn(`Unité "${normalizedUnit}" non trouvée en BD pour "${ingredientName}", utilisation de l'unité par défaut`);
          continue;
        }

        const quantity =
          typeof ing.quantity === 'number' && !Number.isNaN(ing.quantity) && ing.quantity > 0
            ? ing.quantity
            : 1;

        result.push({
          ingredientID: dbIngredient.ingredientID,
          quantity,
          unitID: unitRecord.unitID,
          name: dbIngredient.name,
          unitType: normalizedUnit,
        });
      } catch (error) {
        console.error(`Erreur lors du traitement de l'ingrédient "${ingredientName}":`, error);
      }
    }

    return result;
  }

  private async findIngredientMatch(name: string) {
    const cleaned = name.trim();
    const singular = this.singularizeIngredientName(cleaned);

    const exact = await this.prismaService.ingredient.findFirst({
      where: {
        name: {
          mode: 'insensitive',
          equals: cleaned,
        },
      },
    });
    if (exact) return exact;

    const singularMatch = cleaned !== singular ? await this.prismaService.ingredient.findFirst({
      where: {
        name: {
          mode: 'insensitive',
          equals: singular,
        },
      },
    }) : null;
    if (singularMatch) return singularMatch;

    const containsMatch = await this.prismaService.ingredient.findFirst({
      where: {
        name: {
          mode: 'insensitive',
          contains: cleaned,
        },
      },
      orderBy: { name: 'asc' },
    });
    if (containsMatch) return containsMatch;

    if (singular !== cleaned) {
      const singularContains = await this.prismaService.ingredient.findFirst({
        where: {
          name: {
            mode: 'insensitive',
            contains: singular,
          },
        },
        orderBy: { name: 'asc' },
      });
      if (singularContains) return singularContains;
    }

    const stopWords = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'à', 'au', 'aux', 'pour', 'avec', 'en', 'sur']);
    const tokens = cleaned
      .split(/\s+/)
      .map(token => token.replace(/[^\p{L}0-9]/gu, '').toLowerCase())
      .filter(Boolean)
      .filter(token => token.length >= 4 && !stopWords.has(token));

    for (const token of tokens) {
      const tokenMatch = await this.prismaService.ingredient.findFirst({
        where: {
          name: {
            mode: 'insensitive',
            contains: token,
          },
        },
        orderBy: { name: 'asc' },
      });
      if (tokenMatch) return tokenMatch;
    }

    return null;
  }

  private singularizeIngredientName(name: string): string {
    const lower = name.toLowerCase().trim();
    if (lower.endsWith(' pommes de terre')) {
      return lower.replace(/ pommes de terre$/, ' pomme de terre');
    }
    if (lower.endsWith(' oeufs')) {
      return lower.replace(/ oeufs$/, ' oeuf');
    }
    if (lower.endsWith(' poivrons')) {
      return lower.replace(/ poivrons$/, ' poivron');
    }
    if (lower.endsWith(' tranches')) {
      return lower.replace(/ tranches$/, ' tranche');
    }
    if (lower.endsWith(' feuilles')) {
      return lower.replace(/ feuilles$/, ' feuille');
    }
    if (lower.endsWith(' gousses')) {
      return lower.replace(/ gousses$/, ' gousse');
    }
    if (lower.endsWith('s') && !lower.endsWith('ss')) {
      return lower.slice(0, -1);
    }
    return lower;
  }

  /**
   * Transforme les étapes du format Mistral vers CreateStepDTO
   */
  private transformSteps(steps: any[]): CreateStepDTO[] {
    return steps
      .map((step, index) => ({
        text: step.description || step.text || `Étape ${index + 1}`,
        order: step.order || index + 1,
      }))
      .sort((a, b) => a.order - b.order);
  }
}
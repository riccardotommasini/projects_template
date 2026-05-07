import json

# Load existing JSON
with open('src/data/seed-recipes.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Add 36 new recipes
new_recipes = [
    {
        "name": "Saumon Grillé Citron",
        "description": "Filet de saumon grillé avec citron et herbes fraîches",
        "portion": 2,
        "price": 16.0,
        "prepTime": 10,
        "cookTime": 12,
        "nutritionalScore": 9.0,
        "photo": "https://images.unsplash.com/photo-1580959375944-abd7e991d971?w=400",
        "tags": ["poisson", "sain", "rapide", "facile"],
        "steps": [
            { "order": 1, "text": "Préchauffer le gril à feu moyen-élevé" },
            { "order": 2, "text": "Assaisonner le saumon avec sel et poivre" },
            { "order": 3, "text": "Griler le saumon 6 minutes par côté" },
            { "order": 4, "text": "Ajouter du citron frais en fin de cuisson" },
            { "order": 5, "text": "Servir avec herbes fraîches" }
        ],
        "ingredients": [
            { "ingredientName": "saumon", "quantity": 400, "unit": "g" },
            { "ingredientName": "citron", "quantity": 1, "unit": "pièce" },
            { "ingredientName": "huile d'olive", "quantity": 20, "unit": "ml" }
        ]
    },
    {
        "name": "Pâtes à la Bolognaise",
        "description": "Pâtes avec sauce bolognaise riche à la viande",
        "portion": 3,
        "price": 9.0,
        "prepTime": 15,
        "cookTime": 40,
        "nutritionalScore": 7.5,
        "photo": "https://images.unsplash.com/photo-1621996346565-431f63602f41?w=400",
        "tags": ["italien", "facile", "famille"],
        "steps": [
            { "order": 1, "text": "Faire revenir l'oignon et l'ail" },
            { "order": 2, "text": "Ajouter la viande hachée et cuire jusqu'à doré" },
            { "order": 3, "text": "Ajouter les tomates et laisser mijoter 30 min" },
            { "order": 4, "text": "Cuire les pâtes al dente" },
            { "order": 5, "text": "Verser la sauce sur les pâtes" }
        ],
        "ingredients": [
            { "ingredientName": "pâtes", "quantity": 400, "unit": "g" },
            { "ingredientName": "boeuf", "quantity": 300, "unit": "g" },
            { "ingredientName": "tomate", "quantity": 600, "unit": "g" },
            { "ingredientName": "oignon", "quantity": 1, "unit": "pièce" }
        ]
    },
    {
        "name": "Crevettes à l'Ail",
        "description": "Crevettes poêlées à l'ail avec citron et herbes",
        "portion": 2,
        "price": 15.0,
        "prepTime": 10,
        "cookTime": 8,
        "nutritionalScore": 8.5,
        "photo": "https://images.unsplash.com/photo-1580959375944-abd7e991d971?w=400",
        "tags": ["fruit de mer", "rapide", "sain", "facile"],
        "steps": [
            { "order": 1, "text": "Hacher finement l'ail" },
            { "order": 2, "text": "Faire chauffer l'huile dans une grande poêle" },
            { "order": 3, "text": "Ajouter l'ail et faire cuire 30 secondes" },
            { "order": 4, "text": "Ajouter les crevettes et cuire 4 minutes" },
            { "order": 5, "text": "Presser du citron et servir" }
        ],
        "ingredients": [
            { "ingredientName": "crevettes", "quantity": 400, "unit": "g" },
            { "ingredientName": "ail", "quantity": 5, "unit": "pièce" },
            { "ingredientName": "citron", "quantity": 1, "unit": "pièce" },
            { "ingredientName": "huile d'olive", "quantity": 30, "unit": "ml" }
        ]
    },
    {
        "name": "Pizza Maison",
        "description": "Pizza maison avec sauce tomate, fromage et garnitures",
        "portion": 4,
        "price": 12.0,
        "prepTime": 30,
        "cookTime": 20,
        "nutritionalScore": 6.5,
        "photo": "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=400",
        "tags": ["italien", "facile", "famille"],
        "steps": [
            { "order": 1, "text": "Préchauffer le four à 220°C" },
            { "order": 2, "text": "Étaler la pâte sur une plaque" },
            { "order": 3, "text": "Ajouter sauce tomate, fromage et garnitures" },
            { "order": 4, "text": "Cuire 15-20 minutes jusqu'à doré" },
            { "order": 5, "text": "Laisser refroidir quelques minutes" }
        ],
        "ingredients": [
            { "ingredientName": "tomate", "quantity": 300, "unit": "g" },
            { "ingredientName": "mozzarella", "quantity": 200, "unit": "g" },
            { "ingredientName": "oignon", "quantity": 1, "unit": "pièce" }
        ]
    },
    {
        "name": "Salade Caprese",
        "description": "Salade méditerranéenne avec tomates, mozzarella et basilic",
        "portion": 2,
        "price": 7.0,
        "prepTime": 10,
        "cookTime": 0,
        "nutritionalScore": 8.0,
        "photo": "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400",
        "tags": ["vegetarien", "sain", "rapide", "facile"],
        "steps": [
            { "order": 1, "text": "Trancher les tomates frais" },
            { "order": 2, "text": "Couper la mozzarella en tranches" },
            { "order": 3, "text": "Disposer en alternance sur un plat" },
            { "order": 4, "text": "Ajouter basilic frais" },
            { "order": 5, "text": "Verser huile d'olive et vinaigre" }
        ],
        "ingredients": [
            { "ingredientName": "tomate", "quantity": 500, "unit": "g" },
            { "ingredientName": "mozzarella", "quantity": 250, "unit": "g" },
            { "ingredientName": "huile d'olive", "quantity": 40, "unit": "ml" }
        ]
    }
]

# Add only the first 5 for now, we''ll do a bigger batch
data['recipes'].extend(new_recipes)

# Write back
with open('src/data/seed-recipes.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Added {len(new_recipes)} recipes. Total: {len(data['recipes'])}")

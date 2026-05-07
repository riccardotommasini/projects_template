import json

with open('src/data/seed-recipes.json', 'r') as f:
    data = json.load(f)

recipes_to_add = [
    {
        "name": "Omelette Jambon",
        "description": "Omelette moussue avec jambon",
        "portion": 1,
        "price": 4.0,
        "prepTime": 5,
        "cookTime": 10,
        "nutritionalScore": 7.0,
        "photo": "https://images.unsplash.com/photo-1484723091739-37d5a9a831d5?w=400",
        "tags": ["facile", "rapide", "petit déj"],
        "steps": [
            {"order": 1, "text": "Battre oeufs"},
            {"order": 2, "text": "Chauffer poêle"},
            {"order": 3, "text": "Verser oeufs"},
            {"order": 4, "text": "Ajouter jambon"},
            {"order": 5, "text": "Plier et servir"}
        ],
        "ingredients": [
            {"ingredientName": "oeufs", "quantity": 2, "unit": "pièce"},
            {"ingredientName": "jambon", "quantity": 100, "unit": "g"}
        ]
    },
    {
        "name": "Milkshake Fraise",
        "description": "Milkshake sucré à la fraise",
        "portion": 2,
        "price": 4.0,
        "prepTime": 5,
        "cookTime": 0,
        "nutritionalScore": 6.0,
        "photo": "https://images.unsplash.com/photo-1590080875298-cd003e7e3b7e?w=400",
        "tags": ["boisson", "sucré", "facile"],
        "steps": [
            {"order": 1, "text": "Mixer fraise"},
            {"order": 2, "text": "Ajouter lait"},
            {"order": 3, "text": "Ajouter sucre"},
            {"order": 4, "text": "Mélanger glaçons"},
            {"order": 5, "text": "Servir"}
        ],
        "ingredients": [
            {"ingredientName": "fraise", "quantity": 200, "unit": "g"},
            {"ingredientName": "lait", "quantity": 300, "unit": "ml"}
        ]
    },
    {
        "name": "Nuggets Poulet",
        "description": "Nuggets croustillants maison",
        "portion": 4,
        "price": 5.0,
        "prepTime": 20,
        "cookTime": 20,
        "nutritionalScore": 5.0,
        "photo": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400",
        "tags": ["facile", "rapide"],
        "steps": [
            {"order": 1, "text": "Découper poulet"},
            {"order": 2, "text": "Paner les pièces"},
            {"order": 3, "text": "Frire 15 min"},
            {"order": 4, "text": "Égoutter"},
            {"order": 5, "text": "Servir chaud"}
        ],
        "ingredients": [
            {"ingredientName": "poulet", "quantity": 400, "unit": "g"},
            {"ingredientName": "farine", "quantity": 100, "unit": "g"}
        ]
    },
    {
        "name": "Burger Maison",
        "description": "Burger avec steak haché et légumes",
        "portion": 1,
        "price": 6.0,
        "prepTime": 15,
        "cookTime": 15,
        "nutritionalScore": 6.0,
        "photo": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400",
        "tags": ["facile", "rapide"],
        "steps": [
            {"order": 1, "text": "Former steak"},
            {"order": 2, "text": "Cuire au grill"},
            {"order": 3, "text": "Toaster pain"},
            {"order": 4, "text": "Ajouter légumes"},
            {"order": 5, "text": "Assembler"}
        ],
        "ingredients": [
            {"ingredientName": "boeuf", "quantity": 150, "unit": "g"},
            {"ingredientName": "tomate", "quantity": 50, "unit": "g"}
        ]
    },
    {
        "name": "Falafel Pita",
        "description": "Pita garnie de falafel et sauce",
        "portion": 1,
        "price": 5.0,
        "prepTime": 10,
        "cookTime": 0,
        "nutritionalScore": 7.0,
        "photo": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400",
        "tags": ["vegan", "facile", "rapide"],
        "steps": [
            {"order": 1, "text": "Réchauffer pita"},
            {"order": 2, "text": "Placer falafel"},
            {"order": 3, "text": "Ajouter houmous"},
            {"order": 4, "text": "Ajouter salade"},
            {"order": 5, "text": "Rouler et servir"}
        ],
        "ingredients": [
            {"ingredientName": "pois chiches", "quantity": 100, "unit": "g"},
            {"ingredientName": "pain pita", "quantity": 1, "unit": "pièce"}
        ]
    },
    {
        "name": "Poulet Rôti",
        "description": "Poulet entier rôti aux herbes",
        "portion": 4,
        "price": 10.0,
        "prepTime": 20,
        "cookTime": 60,
        "nutritionalScore": 7.5,
        "photo": "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=400",
        "tags": ["facile", "réconfortant"],
        "steps": [
            {"order": 1, "text": "Préparer poulet"},
            {"order": 2, "text": "Assaisonner"},
            {"order": 3, "text": "Verser vin blanc"},
            {"order": 4, "text": "Rôtir 50 min"},
            {"order": 5, "text": "Laisser reposer"}
        ],
        "ingredients": [
            {"ingredientName": "poulet", "quantity": 1200, "unit": "g"},
            {"ingredientName": "herbes", "quantity": 20, "unit": "g"}
        ]
    },
    {
        "name": "Ratatouille",
        "description": "Ragout de légumes provençal",
        "portion": 4,
        "price": 6.0,
        "prepTime": 25,
        "cookTime": 45,
        "nutritionalScore": 7.5,
        "photo": "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400",
        "tags": ["vegetarien", "sain", "facile"],
        "steps": [
            {"order": 1, "text": "Préparer légumes"},
            {"order": 2, "text": "Faire revenir oignons"},
            {"order": 3, "text": "Alterner couches"},
            {"order": 4, "text": "Ajouter tomates"},
            {"order": 5, "text": "Cuire 40 min"}
        ],
        "ingredients": [
            {"ingredientName": "courgette", "quantity": 200, "unit": "g"},
            {"ingredientName": "aubergine", "quantity": 200, "unit": "g"}
        ]
    },
    {
        "name": "Quiche Lorraine",
        "description": "Quiche aux lardons et fromage",
        "portion": 6,
        "price": 8.0,
        "prepTime": 20,
        "cookTime": 40,
        "nutritionalScore": 5.5,
        "photo": "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400",
        "tags": ["facile", "réconfortant"],
        "steps": [
            {"order": 1, "text": "Étaler pâte"},
            {"order": 2, "text": "Cuire lardons"},
            {"order": 3, "text": "Préparer crème"},
            {"order": 4, "text": "Verser dans pâte"},
            {"order": 5, "text": "Cuire 35 min"}
        ],
        "ingredients": [
            {"ingredientName": "lardons", "quantity": 150, "unit": "g"},
            {"ingredientName": "crème", "quantity": 300, "unit": "ml"}
        ]
    }
]

data['recipes'].extend(recipes_to_add)

with open('src/data/seed-recipes.json', 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

count = len(data['recipes'])
print(f'Total recipes: {count}')

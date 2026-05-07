const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const ingredients = await prisma.ingredient.findMany({
    orderBy: { ingredientID: 'asc' },
    take: 50,
  });
  
  console.log('Ingrédients en BD:');
  console.table(ingredients);
  
  console.log('\nFormat pour copier-coller:');
  ingredients.forEach(ing => {
    console.log(`  { ingredientID: ${ing.ingredientID}, name: "${ing.name}" }`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

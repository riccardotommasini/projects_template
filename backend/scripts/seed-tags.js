require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const tags = [
    "rapide", "italien", "facile", "vegetarien", "sain",
    "épicé", "asiatique", "mexicain", "indien", "famille",
    "moyen", "difficile", "vegan", "sans gluten",
    "poisson", "fruit de mer", "dessert", "sucré", "léger", "réconfortant", "français"
  ];

  for (const tagName of tags) {
    await prisma.tag.upsert({
      where: { name: tagName },
      update: {},
      create: { name: tagName },
    });
  }

  console.log('Tags created/updated');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

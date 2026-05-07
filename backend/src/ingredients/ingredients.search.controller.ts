import { Controller, Get, Query } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

function normalize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .toLowerCase()
}

@Controller('ingredients')
export class IngredientsSearchController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async search(@Query('search') search?: string) {
    const all = await this.prisma.ingredient.findMany({ orderBy: { name: 'asc' } })

    if (!search?.trim()) return all.slice(0, 20)

    const q = normalize(search.trim())
    return all.filter(i => normalize(i.name).includes(q)).slice(0, 20)
  }
}

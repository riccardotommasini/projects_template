import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.tag.findMany({
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(tagID: number) {
    const tag = await this.prisma.tag.findUnique({
      where: { tagID },
    });

    if (!tag) {
      throw new NotFoundException(`Tag with ID ${tagID} not found`);
    }

    return tag;
  }
}

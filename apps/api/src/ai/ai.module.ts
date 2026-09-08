import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module.js';
import { AiController } from './ai.controller.js';
import { GenerateService } from './generation/generate.service.js';
import { SearchService } from './search/search.service.js';
import { ImageService } from './image/image.service.js';
import { AiUsageService } from './ai-usage.service.js';

/**
 * Depends on ProductsModule (SearchService compiles a filter and then asks
 * ProductsService to run it — the same query-compiler path the plain list
 * endpoint uses). ProductsModule does NOT depend back on this module —
 * that one-directional edge is what keeps AiController able to serve
 * `POST /products/:id/image` without a circular import; see the comment at
 * the top of ai.controller.ts for why that route lives here instead of on
 * ProductsController.
 */
@Module({
  imports: [ProductsModule],
  controllers: [AiController],
  providers: [GenerateService, SearchService, ImageService, AiUsageService],
})
export class AiModule {}

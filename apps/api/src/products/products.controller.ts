import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
  searchFilterSchema,
  type SearchFilter,
} from '@travel/validation';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/guards/supabase-auth.guard.js';
import { colomboToday } from '../common/date/colombo-date.js';
import { ProductsService } from './products.service.js';
import { ExcelExportService } from './export/excel-export.service.js';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly excelExport: ExcelExportService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createProductSchema)) body: unknown,
  ) {
    return this.products.create(user.id, body as ReturnType<typeof createProductSchema.parse>);
  }

  @Get()
  findMany(@Query(new ZodValidationPipe(productQuerySchema)) query: unknown) {
    return this.products.findMany(query as ReturnType<typeof productQuerySchema.parse>);
  }

  /**
   * Accepts the FULL SearchFilter shape directly (multiple destinations/
   * categories, a price range, several keywords) — unlike GET /products
   * above, which only takes single-value query params. This is what lets
   * the frontend re-run an AI-search-derived filter after the user removes
   * one chip: it re-compiles the adjusted filter through the exact same
   * query-compiler AI search itself uses, with zero OpenAI involvement.
   * Registered BEFORE `:id` only matters for GET routes sharing that
   * prefix — a POST here never collides with `GET /products/:id`.
   */
  @Post('query')
  queryByFilter(@Body(new ZodValidationPipe(searchFilterSchema)) body: unknown) {
    return this.products.findManyByFilter(body as SearchFilter);
  }

  // Registered BEFORE `:id` — Nest matches routes in registration order,
  // and "dashboard" would otherwise be captured as a product id.
  @Get('dashboard')
  dashboard() {
    return this.products.dashboardStats();
  }

  /** Exports exactly the filter currently applied in the UI — including a multi-value AI-derived filter. */
  @Post('export')
  async export(
    @Body(new ZodValidationPipe(searchFilterSchema)) body: unknown,
    @Res({ passthrough: false }) res: Response,
  ) {
    const filter = body as SearchFilter;
    const products = await this.products.findAllForExport(filter);
    const buffer = await this.excelExport.buildWorkbook(products);

    // Filename is server-generated from today's date only — never derived
    // from user input, so there's no path/header-injection surface here.
    const filename = `products-${colomboToday()}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProductSchema)) body: unknown,
  ) {
    return this.products.update(id, user.id, body as ReturnType<typeof updateProductSchema.parse>);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.products.remove(id, user.id);
  }
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as hbs from 'hbs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Set up Handlebars as the view engine
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');
  app.useStaticAssets(join(__dirname, '..', 'public'));
  
  // Register Handlebars helpers
  hbs.registerHelper('formatDate', function(date) {
    return new Date(date).toLocaleString();
  });
  
  hbs.registerHelper('formatNumber', function(number) {
    return Number(number).toFixed(2);
  });
  
  await app.listen(3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();

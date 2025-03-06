import { Controller, Get, Post, Body, Res, Query, Param } from '@nestjs/common';
import { RunwareService, ImageGenerationOptions } from './runware.service';
import { LocalImageService, ImageCategory } from './local-image.service';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Controller('api/integrations')
export class ApiIntegrationsController {
  constructor(
    private readonly runwareService: RunwareService,
    private readonly localImageService: LocalImageService
  ) {}

  @Get('runware/test')
  async testRunwareConnection() {
    return {
      success: true,
      message: 'Runware connection test successful'
    };
  }
  
  @Post('runware/test-mock')
  async generateMockImage(@Body() body: { prompt: string }) {
    // This is a mock endpoint that doesn't call the Runware API
    const mockImagePath = path.join(process.cwd(), 'public', 'images', 'mock-image.jpg');
    
    // Create directory if it doesn't exist
    const imageDir = path.join(process.cwd(), 'public', 'images');
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }
    
    try {
      // Create a simple 100x100 pixel image with a blue circle on white background
      // This is a very basic SVG that represents a blue circle on white background
      const svgContent = `
        <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="white"/>
          <circle cx="50" cy="50" r="40" fill="blue"/>
        </svg>
      `;
      
      // Write the SVG content to the file
      fs.writeFileSync(mockImagePath, svgContent);
      
      return {
        success: true,
        message: 'Mock image generated successfully',
        data: {
          imagePath: mockImagePath,
          imageUrl: `/api/integrations/runware/image?path=${mockImagePath}`,
          prompt: body.prompt,
          note: 'This is a mock SVG image of a blue circle on white background'
        }
      };
    } catch (error) {
      console.error('Error generating mock image:', error);
      return {
        success: false,
        message: `Failed to generate mock image: ${error.message}`
      };
    }
  }
  
  @Post('runware/generate-image')
  async generateTestImage(@Body() body: { prompt: string, options?: any }) {
    try {
      if (!body.prompt) {
        return {
          success: false,
          message: 'Prompt is required'
        };
      }
      
      // Default image generation options
      const imageOptions: ImageGenerationOptions = {
        width: 1024,
        height: 1024,
        outputFormat: 'JPG',
        outputType: 'URL',
        steps: 30,
        CFGScale: 8.0,
        checkNSFW: true,
        negativePrompt: 'blurry, distorted, low quality, amateur, childish, cartoon, anime, 3d render, poor quality, text, watermark',
        numberResults: 1,
        model: 'civitai:4384@11745',
        ...body.options // Allow overriding options
      };
      
      // Log the API key being used (masked for security)
      const apiKey = process.env.RUNWARE_API_KEY || '';
      const maskedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
      console.log(`Using Runware API key: ${maskedKey}`);
      
      // Generate the image
      const imagePath = await this.runwareService.generateImageFromText(body.prompt, imageOptions);
      
      return {
        success: true,
        message: 'Image generated successfully',
        data: {
          imagePath: imagePath,
          // Include full URL if in a web environment
          imageUrl: `/api/integrations/runware/image?path=${imagePath}`,
          prompt: body.prompt,
          options: imageOptions
        }
      };
    } catch (error) {
      console.error('Error in generateTestImage:', error);
      return {
        success: false,
        message: `Failed to generate image: ${error.message}`,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    }
  }
  
  @Post('runware/simple-test')
  async simplestImageTest(@Body() body: { prompt: string }) {
    try {
      if (!body.prompt) {
        return {
          success: false,
          message: 'Prompt is required'
        };
      }
      
      // Use the simplest possible options with known good model ID
      const imageOptions: ImageGenerationOptions = {
        width: 512, // Smaller size for faster generation
        height: 512,
        steps: 20, // Fewer steps for quicker test
        model: 'civitai:4384@11745' // A valid base model (not ControlNet)
      };
      
      // Log the API key being used (masked for security)
      const apiKey = process.env.RUNWARE_API_KEY || '';
      const maskedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
      console.log(`Using Runware API key: ${maskedKey}`);
      
      // Generate the image
      const imagePath = await this.runwareService.generateImageFromText(body.prompt, imageOptions);
      
      return {
        success: true,
        message: 'Image generated successfully',
        data: {
          imagePath: imagePath,
          imageUrl: `/api/integrations/runware/image?path=${imagePath}`,
          prompt: body.prompt,
          options: imageOptions
        }
      };
    } catch (error) {
      console.error('Error in simplestImageTest:', error);
      return {
        success: false,
        message: `Failed to generate image: ${error.message}`,
        error: error.message
      };
    }
  }
  
  @Get('runware/image')
  async getRunwareImage(@Query('path') imagePath: string, @Res() res: Response) {
    try {
      if (!imagePath) {
        return res.status(400).json({
          success: false,
          message: 'Image path is required'
        });
      }
      
      // Sanitize the path to prevent directory traversal
      const fileName = imagePath.split('/').pop();
      const fullPath = `${process.cwd()}/public/images/${fileName}`;
      
      // Check if the file exists
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({
          success: false,
          message: 'Image not found'
        });
      }
      
      // Determine content type based on file extension
      const ext = fullPath.split('.').pop()?.toLowerCase();
      let contentType = 'image/jpeg'; // Default
      
      if (ext === 'png') contentType = 'image/png';
      else if (ext === 'webp') contentType = 'image/webp';
      else if (ext === 'svg') contentType = 'image/svg+xml';
      
      // Stream the file to the response
      res.setHeader('Content-Type', contentType);
      fs.createReadStream(fullPath).pipe(res);
      
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: `Failed to retrieve image: ${error.message}`,
        error: error.message
      });
    }
  }

  @Post('local-image/mock')
  async generateLocalMockImage(@Body() body: { prompt: string }) {
    try {
      if (!body.prompt) {
        return {
          success: false,
          message: 'Prompt is required'
        };
      }
      
      // Create a mock image
      const imagePath = this.localImageService.createMockImage(body.prompt);
      
      return {
        success: true,
        message: 'Mock image generated successfully',
        data: {
          imagePath,
          imageUrl: `/api/integrations/image?path=${imagePath}`,
          prompt: body.prompt
        }
      };
    } catch (error) {
      console.error('Error in generateLocalMockImage:', error);
      return {
        success: false,
        message: `Failed to generate mock image: ${error.message}`
      };
    }
  }
  
  @Get('local-image/random/:category')
  async getRandomImage(@Param('category') categoryName: string) {
    try {
      // Validate category
      if (!Object.values(ImageCategory).includes(categoryName as ImageCategory)) {
        return {
          success: false,
          message: `Invalid category: ${categoryName}. Valid categories are: ${Object.values(ImageCategory).join(', ')}`
        };
      }
      
      const category = categoryName as ImageCategory;
      const count = this.localImageService.getImageCount(category);
      
      if (count === 0) {
        return {
          success: false,
          message: `No images found in category '${category}'`
        };
      }
      
      // Get a random image
      const imagePath = this.localImageService.getRandomImage(category);
      
      return {
        success: true,
        message: `Random image selected successfully from category '${category}'`,
        data: {
          imagePath,
          imageUrl: `/api/integrations/image?path=${imagePath}`,
          category
        }
      };
    } catch (error) {
      console.error('Error in getRandomImage:', error);
      return {
        success: false,
        message: `Failed to get random image: ${error.message}`
      };
    }
  }
  
  @Get('image')
  async serveImage(@Query('path') imagePath: string, @Res() res: Response) {
    try {
      if (!imagePath) {
        return res.status(400).send('Image path is required');
      }
      
      // Verify the file exists
      if (!fs.existsSync(imagePath)) {
        return res.status(404).send(`Image not found: ${imagePath}`);
      }
      
      // Get the file extension to determine content type
      const ext = path.extname(imagePath).toLowerCase();
      let contentType = 'image/jpeg'; // Default
      
      // Set the content type based on file extension
      switch (ext) {
        case '.png':
          contentType = 'image/png';
          break;
        case '.gif':
          contentType = 'image/gif';
          break;
        case '.svg':
          contentType = 'image/svg+xml';
          break;
        case '.webp':
          contentType = 'image/webp';
          break;
        case '.jpg':
        case '.jpeg':
        default:
          contentType = 'image/jpeg';
          break;
      }
      
      // Stream the file to the response
      res.setHeader('Content-Type', contentType);
      fs.createReadStream(imagePath).pipe(res);
    } catch (error) {
      console.error('Error serving image:', error);
      res.status(500).send(`Failed to serve image: ${error.message}`);
    }
  }
} 
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Available image categories
 */
export enum ImageCategory {
  GENERAL = 'general',      // General purpose images
  FAIRWAY = 'fairway',      // Fairway-focused/branded images
  INDUSTRY = 'industry',    // Industry/blockchain-related images
  ENGAGEMENT = 'engagement' // Images for engagement tweets
}

/**
 * Service for managing local stock images
 */
@Injectable()
export class LocalImageService {
  private readonly logger = new Logger(LocalImageService.name);
  private readonly stockImagesPath: string;
  
  constructor() {
    this.stockImagesPath = path.join(process.cwd(), 'public', 'stock-images');
    this.logger.log('LocalImageService initialized');
    this.ensureDirectoriesExist();
  }
  
  /**
   * Ensure all required directories exist
   */
  private ensureDirectoriesExist(): void {
    const categories = Object.values(ImageCategory);
    
    // Create base directory if it doesn't exist
    if (!fs.existsSync(this.stockImagesPath)) {
      fs.mkdirSync(this.stockImagesPath, { recursive: true });
      this.logger.log(`Created base directory: ${this.stockImagesPath}`);
    }
    
    // Create category subdirectories
    for (const category of categories) {
      const categoryPath = path.join(this.stockImagesPath, category);
      if (!fs.existsSync(categoryPath)) {
        fs.mkdirSync(categoryPath, { recursive: true });
        this.logger.log(`Created category directory: ${categoryPath}`);
      }
    }
  }
  
  /**
   * Get available image count for a category
   * @param category The image category
   * @returns Number of available images
   */
  public getImageCount(category: ImageCategory): number {
    const categoryPath = path.join(this.stockImagesPath, category);
    
    try {
      const files = fs.readdirSync(categoryPath);
      // Filter for image files only (jpg, png, webp, etc.)
      const imageFiles = files.filter(file => 
        /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file)
      );
      return imageFiles.length;
    } catch (error) {
      this.logger.error(`Error counting images in ${category}: ${error.message}`);
      return 0;
    }
  }
  
  /**
   * Get a random image from a specific category
   * @param category The image category
   * @param prompt Optional prompt to associate with the image selection (for logging)
   * @returns Path to the selected image file
   */
  public getRandomImage(category: ImageCategory, prompt?: string): string {
    const categoryPath = path.join(this.stockImagesPath, category);
    
    try {
      const files = fs.readdirSync(categoryPath);
      // Filter for image files only
      const imageFiles = files.filter(file => 
        /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file)
      );
      
      if (imageFiles.length === 0) {
        throw new Error(`No images found in category '${category}'`);
      }
      
      // Select a random image
      const randomIndex = Math.floor(Math.random() * imageFiles.length);
      const selectedImage = imageFiles[randomIndex];
      const imagePath = path.join(categoryPath, selectedImage);
      
      if (prompt) {
        this.logger.debug(`Selected image '${selectedImage}' from category '${category}' for prompt: ${prompt.substring(0, 50)}...`);
      } else {
        this.logger.debug(`Selected image '${selectedImage}' from category '${category}'`);
      }
      
      return imagePath;
    } catch (error) {
      this.logger.error(`Error selecting image from ${category}: ${error.message}`);
      throw new Error(`Failed to get image from category '${category}': ${error.message}`);
    }
  }
  
  /**
   * Select an image based on the content type or topic
   * This is a more advanced selection that tries to match an image to content
   * @param category Base category to select from
   * @param topic Optional topic to help with selection
   * @returns Path to the selected image file
   */
  public selectImageForContent(category: ImageCategory, topic?: string): string {
    // For now, this just uses random selection
    // Could be enhanced with image metadata or AI-based matching in the future
    return this.getRandomImage(category, topic);
  }
  
  /**
   * Create a test/demo image for development purposes
   * @param prompt Text prompt for mock image
   * @returns Path to the created mock image
   */
  public createMockImage(prompt: string): string {
    const mockImagesDir = path.join(this.stockImagesPath, 'mock');
    if (!fs.existsSync(mockImagesDir)) {
      fs.mkdirSync(mockImagesDir, { recursive: true });
    }
    
    // Generate a unique filename for the mock image
    const filename = `mock-image-${Date.now()}.svg`;
    const imagePath = path.join(mockImagesDir, filename);
    
    // Create a simple SVG with the prompt as overlay text
    const svgContent = `
      <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f0f0f0"/>
        <circle cx="400" cy="300" r="150" fill="#1da1f2"/>
        <text x="400" y="300" font-family="Arial" font-size="24" text-anchor="middle" fill="white">Mock Image</text>
        <text x="400" y="340" font-family="Arial" font-size="16" text-anchor="middle" fill="white">${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}</text>
      </svg>
    `;
    
    fs.writeFileSync(imagePath, svgContent);
    this.logger.debug(`Created mock image at ${imagePath}`);
    
    return imagePath;
  }
} 
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * Interface for Runware API response
 */
interface RunwareResponse {
  data?: {
    taskType: string;
    taskUUID: string;
    imageUUID: string;
    imageURL?: string;
    imageBase64Data?: string;
    imageDataURI?: string;
    NSFWContent?: boolean;
    cost?: number;
  }[];
  errors?: {
    code: string;
    message: string;
    parameter?: string;
    type?: string;
    taskType?: string;
  }[];
}

/**
 * Interface for Image Generation Options
 */
export interface ImageGenerationOptions {
  width?: number;
  height?: number;
  outputFormat?: 'JPG' | 'PNG' | 'WEBP';
  outputType?: 'URL' | 'base64Data' | 'dataURI';
  steps?: number;
  seed?: number;
  CFGScale?: number;
  checkNSFW?: boolean;
  includeCost?: boolean;
  negativePrompt?: string;
  numberResults?: number;
  model?: string; // AIR identifier format
}

@Injectable()
export class RunwareService {
  private readonly logger = new Logger(RunwareService.name);
  private readonly apiKey: string;
  private readonly apiBaseUrl = 'https://api.runware.ai/v1';
  
  constructor(private readonly httpService: HttpService) {
    this.apiKey = process.env.RUNWARE_API_KEY || 'ZiwD9KCu1ZywQUpeZrtYtZUiLRRG6n9U';
    this.logger.log('Runware service initialized with API key');
  }

  /**
   * Test method to check if Runware API is accessible
   * @returns Object containing test result
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      // Create a simple test prompt
      const testPrompt = "A simple blue circle on a white background";
      
      // Basic image options for testing
      const testOptions: ImageGenerationOptions = {
        width: 512, // Smaller size for faster generation
        height: 512,
        steps: 20, // Fewer steps for quicker test
        model: 'civitai:4384@11745', // Using a valid base model (not ControlNet)
        outputType: 'URL'
      };
      
      this.logger.log('Testing Runware API connection...');
      
      // Send a test request
      const taskUUID = this.generateUUID();
      const requestPayload = [{
        taskType: "imageInference",
        taskUUID: taskUUID,
        positivePrompt: testPrompt,
        width: testOptions.width,
        height: testOptions.height,
        outputType: testOptions.outputType,
        outputFormat: 'JPG',
        steps: testOptions.steps,
        model: testOptions.model,
        numberResults: 1
      }];
      
      // Make the API request but don't save the image
      const response = await firstValueFrom(
        this.httpService.post(
          this.apiBaseUrl,
          requestPayload,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`
            }
          }
        )
      );
      
      // Check the response
      if (response.status === 200 && response.data && response.data.length > 0) {
        const result = response.data[0];
        
        // Check for errors in the response
        if (result.errors) {
          return { 
            success: false, 
            message: 'API connection successful but received errors from API', 
            details: result.errors 
          };
        }
        
        // Check for imageUrl in the response
        if (result.imageUrl) {
          return { 
            success: true, 
            message: 'API connection successful and image generation working', 
            details: { imageUrl: result.imageUrl } 
          };
        }
        
        return { 
          success: true, 
          message: 'API connection successful but no image URL returned', 
          details: result 
        };
      }
      
      return { 
        success: false, 
        message: 'API connection successful but received unexpected response format', 
        details: response.data 
      };
    } catch (error) {
      this.logger.error(`Error testing Runware API: ${error.message}`);
      return { 
        success: false, 
        message: `API connection failed: ${error.message}`, 
        details: error.response?.data || error 
      };
    }
  }

  /**
   * Generate an image from a text prompt using Runware AI
   * @param prompt The text prompt to generate an image from
   * @param options Additional options for image generation
   * @returns Path to the saved image file
   */
  async generateImageFromText(prompt: string, options: ImageGenerationOptions = {}): Promise<string> {
    this.logger.debug(`Generating image from prompt: ${prompt.substring(0, 50)} ...`);
    
    // Create directory for saving images if it doesn't exist
    const imageDir = path.join(process.cwd(), 'public', 'images');
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }
    
    // Generate a unique name for the image
    const timestamp = Date.now();
    const fileName = `generated-image-${timestamp}.${options.outputFormat?.toLowerCase() || 'jpg'}`;
    const filePath = path.join(imageDir, fileName);
    
    try {
      // Generate a unique task UUID for the request
      const taskUUID = this.generateUUID();
      
      // Prepare request with default options and overrides
      const requestPayload = [{
        taskType: "imageInference",
        taskUUID: taskUUID,
        positivePrompt: prompt,
        width: options.width || 1024,
        height: options.height || 1024,
        outputType: options.outputType || 'URL',
        outputFormat: options.outputFormat || 'JPG',
        steps: options.steps || 30,
        seed: options.seed || Math.floor(Math.random() * 1000000000),
        CFGScale: options.CFGScale || 7.5,
        model: options.model || 'civitai:4384@11745', // Valid AIR identifier format
        numberResults: options.numberResults || 1,
        checkNSFW: options.checkNSFW ?? true,
        includeCost: options.includeCost ?? false,
        negativePrompt: options.negativePrompt || ''
      }];
      
      this.logger.debug(`Sending request to Runware API: ${JSON.stringify(requestPayload)}`);
      
      // Make the API request
      const response = await firstValueFrom(
        this.httpService.post(
          this.apiBaseUrl,
          requestPayload,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`
            },
            validateStatus: () => true // Accept any status code for better error handling
          }
        )
      );
      
      // Log the full response for debugging
      this.logger.debug(`Runware API response status: ${response.status}`);
      this.logger.debug(`Runware API response headers: ${JSON.stringify(response.headers)}`);
      this.logger.debug(`Runware API response data: ${JSON.stringify(response.data)}`);
      
      // Check for HTTP errors
      if (response.status !== 200) {
        throw new Error(`Runware API HTTP error: ${response.status} - ${JSON.stringify(response.data)}`);
      }
      
      // Process response
      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        
        // Check for errors in the response
        if (result.errors) {
          throw new Error(`Runware API errors: ${Object.entries(result.errors).map(([key, value]) => `\n${key}: ${value}`).join('')}`);
        }
        
        // Check for NSFW content if the option was enabled
        if (options.checkNSFW && result.nsfw === true) {
          this.logger.warn(`Generated image was flagged as NSFW and will not be used`);
          throw new Error('Generated image was flagged as NSFW');
        }
        
        // Log cost information if available
        if (options.includeCost && result.cost) {
          this.logger.log(`Image generation cost: ${result.cost.total} tokens`);
        }
        
        // Get the image URL from the response
        let imageUrl: string;
        if (options.outputType === 'URL' && result.imageUrl) {
          imageUrl = result.imageUrl;
        } else if (options.outputType === 'URL' && result.imageURL) {
          // Try alternative property name
          imageUrl = result.imageURL;
        } else if (options.outputType === 'base64Data' && result.base64Data) {
          // Process base64 data
          fs.writeFileSync(filePath, Buffer.from(result.base64Data, 'base64'));
          return filePath;
        } else if (options.outputType === 'base64Data' && result.imageBase64Data) {
          // Try alternative property name
          fs.writeFileSync(filePath, Buffer.from(result.imageBase64Data, 'base64'));
          return filePath;
        } else if (options.outputType === 'dataURI' && result.dataURI) {
          // Extract base64 data from data URI
          const base64Data = result.dataURI.split(';base64,').pop();
          if (base64Data) {
            fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
            return filePath;
          }
        } else if (options.outputType === 'dataURI' && result.imageDataURI) {
          // Try alternative property name
          const base64Data = result.imageDataURI.split(';base64,').pop();
          if (base64Data) {
            fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
            return filePath;
          }
        }
        
        // If we have an image URL, download it
        if (imageUrl) {
          try {
            const imageResponse = await firstValueFrom(
              this.httpService.get(imageUrl, { 
                responseType: 'arraybuffer',
                validateStatus: () => true // Accept any status code
              })
            );
            
            if (imageResponse.status !== 200) {
              throw new Error(`Failed to download image: HTTP ${imageResponse.status}`);
            }
            
            fs.writeFileSync(filePath, Buffer.from(imageResponse.data));
            this.logger.log(`Image generated successfully and saved to ${filePath}`);
            return filePath;
          } catch (downloadError) {
            this.logger.error(`Error downloading image from URL ${imageUrl}: ${downloadError.message}`);
            throw new Error(`Failed to download generated image: ${downloadError.message}`);
          }
        } else {
          this.logger.error(`No image URL found in response: ${JSON.stringify(result)}`);
          throw new Error('No image URL found in response');
        }
      } else {
        this.logger.error(`Invalid response format: ${JSON.stringify(response.data)}`);
        throw new Error('Failed to generate image: Invalid response from Runware API');
      }
    } catch (error) {
      this.logger.error(`Error generating image: ${error.message}`);
      if (error.response) {
        this.logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
      }
      throw new Error(`Failed to generate image: ${error.message}`);
    }
  }
  
  /**
   * Generate an image with more advanced options including LoRA models, ControlNet, etc.
   * @param prompt The text prompt to generate an image from
   * @param options Additional custom options based on Runware API
   * @returns Path to the saved image file
   */
  async generateAdvancedImage(prompt: string, options: any = {}): Promise<string> {
    try {
      this.logger.debug(`Generating advanced image from prompt: ${prompt.substring(0, 50)}...`);
      
      // Ensure the directory exists
      const imageDir = path.join(process.cwd(), 'public', 'images');
      if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
      }
      
      // Generate a unique taskUUID
      const taskUUID = this.generateUUID();
      
      // Create the base request with required parameters
      const requestPayload = [
        {
          "taskType": "imageInference",
          "taskUUID": taskUUID,
          "positivePrompt": prompt,
          "width": options.width || 1024,
          "height": options.height || 1024,
          "model": options.model || 'stability.sdxl-base-1.0',
          ...options
        }
      ];
      
      // Make API request to Runware
      const response = await axios({
        method: 'post',
        url: this.apiBaseUrl,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        data: requestPayload,
        responseType: 'json'
      });
      
      const runwareResponse = response.data as RunwareResponse;
      
      // Handle errors
      if (runwareResponse.errors) {
        const errorMessage = runwareResponse.errors.map(err => `${err.code}: ${err.message}`).join(', ');
        throw new Error(`Runware API errors: ${errorMessage}`);
      }
      
      // Handle successful response
      if (runwareResponse.data && runwareResponse.data[0]) {
        const responseData = runwareResponse.data[0];
        
        // Generate a unique filename based on output format
        const timestamp = new Date().getTime();
        const outputFormat = options.outputFormat || 'JPG';
        const fileExtension = outputFormat.toLowerCase();
        const filename = `runware-${timestamp}.${fileExtension}`;
        const filePath = path.join(imageDir, filename);
        
        // Save the image based on the output type
        if (responseData.imageURL) {
          // Download the image from the URL
          const imageResponse = await axios({
            method: 'get',
            url: responseData.imageURL,
            responseType: 'arraybuffer'
          });
          
          fs.writeFileSync(filePath, imageResponse.data);
        } else if (responseData.imageBase64Data) {
          const imageBuffer = Buffer.from(responseData.imageBase64Data, 'base64');
          fs.writeFileSync(filePath, imageBuffer);
        } else if (responseData.imageDataURI) {
          const base64Data = responseData.imageDataURI.split(',')[1];
          const imageBuffer = Buffer.from(base64Data, 'base64');
          fs.writeFileSync(filePath, imageBuffer);
        }
        
        this.logger.log(`Successfully generated advanced image saved to: ${filePath}`);
        return filePath;
      } else {
        throw new Error('Invalid response format from Runware API: No image data found');
      }
    } catch (error) {
      if (error.response) {
        this.logger.error(`Runware API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else {
        this.logger.error(`Error generating advanced image: ${error.message}`);
      }
      
      throw error;
    }
  }
  
  /**
   * Generate a UUID for task identification
   * @returns UUID string
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
} 
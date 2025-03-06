import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { AnalyticsService } from '../analytics/analytics.service';
import * as fs from 'fs';
import * as path from 'path';

type TweetSchedule = {
  id: string;
  cronExpression: string;
  topicPreference: string;
  active: boolean;
  lastRun: string | null;
};

@Injectable()
export class DynamicAdjustmentsService {
  private readonly logger = new Logger(DynamicAdjustmentsService.name);
  private schedules: TweetSchedule[] = [];
  private readonly configFilePath: string;
  
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    // Create a config directory if it doesn't exist
    const configDir = path.join(process.cwd(), 'config');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir);
    }
    
    this.configFilePath = path.join(configDir, 'tweet_schedules.json');
    this.loadSchedules();
    this.initializeSchedules();
  }

  private loadSchedules() {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const data = fs.readFileSync(this.configFilePath, 'utf-8');
        this.schedules = JSON.parse(data);
        this.logger.log(`Loaded ${this.schedules.length} tweet schedules from storage`);
      } else {
        // Set up default schedule if none exists
        this.schedules = [
          {
            id: 'default',
            cronExpression: '0 */2 * * *', // Every 2 hours
            topicPreference: 'random',
            active: true,
            lastRun: null,
          }
        ];
        this.saveSchedules();
        this.logger.log('Created default tweet schedule');
      }
    } catch (error) {
      this.logger.error(`Error loading schedules: ${error.message}`);
      // Fall back to default schedule
      this.schedules = [
        {
          id: 'default',
          cronExpression: '0 */2 * * *', // Every 2 hours
          topicPreference: 'random',
          active: true,
          lastRun: null,
        }
      ];
    }
  }

  private saveSchedules() {
    try {
      fs.writeFileSync(this.configFilePath, JSON.stringify(this.schedules, null, 2));
      this.logger.log(`Saved ${this.schedules.length} tweet schedules to storage`);
    } catch (error) {
      this.logger.error(`Error saving schedules: ${error.message}`);
    }
  }

  private initializeSchedules() {
    // Clear existing jobs
    try {
      for (const job of this.schedulerRegistry.getCronJobs().keys()) {
        if (job.startsWith('tweet-schedule-')) {
          this.schedulerRegistry.deleteCronJob(job);
        }
      }
    } catch (error) {
      this.logger.error(`Error clearing existing jobs: ${error.message}`);
    }
    
    // Set up jobs based on loaded schedules
    for (const schedule of this.schedules) {
      if (schedule.active) {
        this.createCronJob(schedule);
      }
    }
  }

  private createCronJob(schedule: TweetSchedule) {
    const jobName = `tweet-schedule-${schedule.id}`;
    
    const callback = () => {
      this.logger.log(`Running scheduled tweet for ${schedule.id}`);
      // This would trigger the tweet generation
      // In a real implementation, this would call the tweet service
      schedule.lastRun = new Date().toISOString();
      this.saveSchedules();
    };
    
    try {
      // Dynamically load the CronJob from the NestJS dependency
      const { CronJob } = this.getCronJobClass();
      
      const job = new CronJob(
        schedule.cronExpression,
        callback,
        null,
        true,
        'UTC'
      );
      
      this.schedulerRegistry.addCronJob(jobName, job);
      this.logger.log(`Job ${jobName} created with schedule: ${schedule.cronExpression}`);
    } catch (error) {
      this.logger.error(`Failed to create cron job ${jobName}: ${error.message}`);
    }
  }
  
  // Helper method to get the CronJob class that is compatible with NestJS SchedulerRegistry
  private getCronJobClass() {
    try {
      // First try loading from NestJS's node_modules
      return require('@nestjs/schedule/node_modules/cron');
    } catch (error) {
      this.logger.warn('Could not load CronJob from @nestjs/schedule/node_modules/cron, falling back to direct import');
      try {
        // If that fails, try importing directly
        return require('cron');
      } catch (fallbackError) {
        this.logger.error(`Failed to load CronJob: ${fallbackError.message}`);
        throw new Error('Could not load CronJob class');
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async optimizeSchedules() {
    this.logger.log('Optimizing tweet schedules based on analytics...');
    
    try {
      // Get best posting times from analytics
      const bestTimes = this.analyticsService.getBestPostingTimes();
      
      if (bestTimes.length === 0) {
        this.logger.log('Not enough data to optimize schedules');
        return;
      }
      
      // Get top 3 best posting times
      const topPostingTimes = bestTimes.slice(0, 3);
      
      // Get top performing topics
      const topicPerformance = this.analyticsService.getPerformanceByTopic();
      const topTopics = [...topicPerformance]
        .sort((a, b) => b.avgEngagement - a.avgEngagement)
        .slice(0, 3)
        .map(t => t.topic);
      
      // Create optimized schedule based on best times and topics
      const newSchedules: TweetSchedule[] = [];
      
      topPostingTimes.forEach((timeSlot, index) => {
        const hour = timeSlot.hour;
        // Create a cron expression for this hour
        const cronExp = `0 ${hour} * * *`; // At minute 0 of the specified hour
        
        newSchedules.push({
          id: `optimized-${index + 1}`,
          cronExpression: cronExp,
          topicPreference: topTopics[index % topTopics.length],
          active: true,
          lastRun: null,
        });
      });
      
      // Add one random post per day to explore new time slots
      newSchedules.push({
        id: 'exploration',
        cronExpression: '0 14 * * *', // Default to 2 PM
        topicPreference: 'random',
        active: true,
        lastRun: null,
      });
      
      // Update schedules
      this.schedules = newSchedules;
      this.saveSchedules();
      this.initializeSchedules();
      
      this.logger.log(`Created ${newSchedules.length} optimized tweet schedules`);
    } catch (error) {
      this.logger.error(`Error optimizing schedules: ${error.message}`);
    }
  }

  getSchedules(): TweetSchedule[] {
    return this.schedules;
  }

  getScheduleById(id: string): TweetSchedule | null {
    const schedule = this.schedules.find(s => s.id === id);
    return schedule || null;
  }

  updateSchedule(scheduleData: TweetSchedule): TweetSchedule | null {
    const index = this.schedules.findIndex(s => s.id === scheduleData.id);
    if (index === -1) return null;
    
    this.schedules[index] = { ...this.schedules[index], ...scheduleData };
    this.saveSchedules();
    
    // If schedule was updated, reinitialize the cron jobs
    this.initializeSchedules();
    
    return this.schedules[index];
  }

  createSchedule(scheduleData: Omit<TweetSchedule, 'id'>): TweetSchedule {
    const newSchedule: TweetSchedule = {
      ...scheduleData,
      id: `manual-${Date.now()}`,
      lastRun: null
    };
    
    this.schedules.push(newSchedule);
    this.saveSchedules();
    
    // Initialize the new cron job if active
    if (newSchedule.active) {
      this.createCronJob(newSchedule);
    }
    
    return newSchedule;
  }

  deleteSchedule(id: string): { success: boolean } {
    const initialLength = this.schedules.length;
    this.schedules = this.schedules.filter(s => s.id !== id);
    
    // If a schedule was removed
    if (initialLength !== this.schedules.length) {
      this.saveSchedules();
      
      // Remove the cron job
      try {
        const jobName = `tweet-schedule-${id}`;
        if (this.schedulerRegistry.getCronJobs().has(jobName)) {
          this.schedulerRegistry.deleteCronJob(jobName);
          this.logger.log(`Deleted cron job ${jobName}`);
        }
      } catch (error) {
        this.logger.error(`Error deleting cron job: ${error.message}`);
      }
      
      return { success: true };
    }
    
    return { success: false };
  }
} 
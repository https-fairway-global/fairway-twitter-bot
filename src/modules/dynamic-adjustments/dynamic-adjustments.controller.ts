import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { DynamicAdjustmentsService } from './dynamic-adjustments.service';

@Controller('dynamic-adjustments')
export class DynamicAdjustmentsController {
  constructor(private readonly dynamicAdjustmentsService: DynamicAdjustmentsService) {}

  @Get('schedules')
  getSchedules() {
    return this.dynamicAdjustmentsService.getSchedules();
  }

  @Put('schedules/:id')
  updateSchedule(@Param('id') id: string, @Body() updates: any) {
    return this.dynamicAdjustmentsService.updateSchedule(id, updates);
  }

  @Post('schedules')
  addSchedule(@Body() schedule: any) {
    return this.dynamicAdjustmentsService.addSchedule(schedule);
  }

  @Get('optimize')
  async optimizeSchedules() {
    await this.dynamicAdjustmentsService.optimizeSchedules();
    return { message: 'Schedule optimization completed' };
  }
} 
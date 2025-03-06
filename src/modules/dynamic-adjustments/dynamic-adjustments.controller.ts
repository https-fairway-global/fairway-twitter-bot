import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { DynamicAdjustmentsService } from './dynamic-adjustments.service';

@Controller('api/schedules')
export class DynamicAdjustmentsController {
  constructor(private readonly dynamicAdjustmentsService: DynamicAdjustmentsService) {}

  @Get()
  getSchedules() {
    return this.dynamicAdjustmentsService.getSchedules();
  }

  @Get(':id')
  getScheduleById(@Param('id') id: string) {
    return this.dynamicAdjustmentsService.getScheduleById(id);
  }

  @Post()
  createSchedule(@Body() scheduleData: any) {
    return this.dynamicAdjustmentsService.createSchedule(scheduleData);
  }

  @Put()
  updateSchedule(@Body() scheduleData: any) {
    return this.dynamicAdjustmentsService.updateSchedule(scheduleData);
  }

  @Delete(':id')
  deleteSchedule(@Param('id') id: string) {
    return this.dynamicAdjustmentsService.deleteSchedule(id);
  }

  @Post('optimize')
  optimizeSchedules() {
    return this.dynamicAdjustmentsService.optimizeSchedules();
  }
} 
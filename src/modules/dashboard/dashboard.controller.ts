import { Controller, Get, Render } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @Render('dashboard')
  async getDashboard() {
    const data = await this.dashboardService.getDashboardData();
    return { data };
  }

  @Get('api/data')
  async getDashboardData() {
    return this.dashboardService.getDashboardData();
  }
} 
import { AdminRepository } from './admin.repository';

export class AdminService {
  private repo = new AdminRepository();

  getStats(): Promise<Record<string, unknown>> {
    return this.repo.getStats();
  }

  getDashboard(): Promise<Record<string, unknown>> {
    return this.repo.getDashboard();
  }

  getReports(): Promise<Record<string, unknown>> {
    return this.repo.getReports();
  }
}

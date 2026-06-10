class TerminateEmployee:
    def execute(self, employee, termination_date):
        employee.status = employee.Status.TERMINATED
        employee.termination_date = termination_date
        employee.save(update_fields=("status", "termination_date", "updated_at"))
        return employee

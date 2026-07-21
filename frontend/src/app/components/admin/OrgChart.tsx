import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, UserRound, Users } from 'lucide-react';
import type { Employee } from '../../services/employees.service';

export interface OrgChartNode {
  employee: Employee;
  children: OrgChartNode[];
}

function employeeName(employee: Employee): string {
  return `${employee.first_name} ${employee.last_name}`.trim() || employee.employee_code;
}

/** Arma el bosque jerárquico (uno o más árboles raíz) a partir de la lista plana de
 * empleados, usando employee.manager. Empleados sin manager Y sin nadie a cargo se
 * devuelven aparte en `unassigned`, para no ensuciar el árbol con nodos sueltos. */
export function buildOrgForest(employees: Employee[]): { roots: OrgChartNode[]; unassigned: Employee[] } {
  const activeEmployees = employees.filter((employee) => employee.status === 'ACTIVE');
  const byId = new Map(activeEmployees.map((employee) => [employee.id, employee]));
  const childrenByManager = new Map<string, Employee[]>();

  activeEmployees.forEach((employee) => {
    if (employee.manager && byId.has(employee.manager)) {
      const list = childrenByManager.get(employee.manager) ?? [];
      list.push(employee);
      childrenByManager.set(employee.manager, list);
    }
  });

  const buildNode = (employee: Employee): OrgChartNode => ({
    employee,
    children: (childrenByManager.get(employee.id) ?? [])
      .sort((a, b) => employeeName(a).localeCompare(employeeName(b)))
      .map(buildNode),
  });

  const roots = activeEmployees
    .filter((employee) => !employee.manager || !byId.has(employee.manager))
    .filter((employee) => (childrenByManager.get(employee.id) ?? []).length > 0)
    .sort((a, b) => employeeName(a).localeCompare(employeeName(b)))
    .map(buildNode);

  const unassigned = activeEmployees
    .filter((employee) => (!employee.manager || !byId.has(employee.manager)) && !(childrenByManager.get(employee.id) ?? []).length)
    .sort((a, b) => employeeName(a).localeCompare(employeeName(b)));

  return { roots, unassigned };
}

function NodeCard({
  employee,
  positionName,
  departmentName,
  reportsCount,
  highlighted,
}: {
  employee: Employee;
  positionName: string;
  departmentName: string;
  reportsCount: number;
  highlighted: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-2.5 rounded-xl border px-3 py-2.5 shadow-sm transition-colors ${
        highlighted ? 'border-[#2a4038] bg-[#eef4f1]' : 'border-gray-100 bg-white'
      }`}
    >
      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
        <UserRound size={16} className="text-gray-400" />
      </div>
      <div className="min-w-0 text-left">
        <p className="text-xs font-semibold text-gray-900 whitespace-nowrap">{employeeName(employee)}</p>
        <p className="text-[10px] text-gray-500 whitespace-nowrap">{positionName}</p>
        {departmentName && <p className="text-[10px] text-gray-400 whitespace-nowrap">{departmentName}</p>}
      </div>
      {reportsCount > 0 && (
        <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-[#2a4038] bg-white border border-[#2a4038]/20 rounded-full px-1.5 py-0.5">
          <Users size={10} />
          {reportsCount}
        </span>
      )}
    </div>
  );
}

function OrgChartBranch({
  node,
  positionById,
  departmentById,
  searchQuery,
  depth,
}: {
  node: OrgChartNode;
  positionById: Map<string, { name: string }>;
  departmentById: Map<string, { name: string }>;
  searchQuery: string;
  depth: number;
}) {
  const [collapsed, setCollapsed] = useState(depth >= 2);
  const hasChildren = node.children.length > 0;
  const query = searchQuery.trim().toLowerCase();
  const matchesSearch = !query || employeeName(node.employee).toLowerCase().includes(query);

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center">
        <div className={matchesSearch || !query ? '' : 'opacity-40'}>
          <NodeCard
            employee={node.employee}
            positionName={positionById.get(node.employee.position ?? '')?.name ?? 'Sin cargo'}
            departmentName={departmentById.get(node.employee.department ?? '')?.name ?? ''}
            reportsCount={node.children.length}
            highlighted={Boolean(query) && matchesSearch}
          />
        </div>
        {hasChildren && (
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="ml-1.5 flex-shrink-0 w-5 h-5 rounded-full border border-gray-200 bg-white text-gray-400 hover:text-[#2a4038] hover:border-[#2a4038] flex items-center justify-center transition-colors"
            title={collapsed ? 'Expandir equipo' : 'Colapsar equipo'}
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>

      {hasChildren && !collapsed && (
        <>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-start gap-4 relative pt-4">
            <div className="absolute top-0 left-0 right-0 flex justify-center">
              <div className="h-px bg-gray-200" style={{ width: node.children.length > 1 ? 'calc(100% - 2.5rem)' : '0' }} />
            </div>
            {node.children.map((child) => (
              <div key={child.employee.id} className="relative flex flex-col items-center">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-px h-4 bg-gray-200" />
                <OrgChartBranch
                  node={child}
                  positionById={positionById}
                  departmentById={departmentById}
                  searchQuery={searchQuery}
                  depth={depth + 1}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function OrgChart({
  roots,
  unassigned,
  positionById,
  departmentById,
  searchQuery,
}: {
  roots: OrgChartNode[];
  unassigned: Employee[];
  positionById: Map<string, { name: string }>;
  departmentById: Map<string, { name: string }>;
  searchQuery: string;
}) {
  const totalInTree = useMemo(() => {
    const count = (node: OrgChartNode): number => 1 + node.children.reduce((acc, child) => acc + count(child), 0);
    return roots.reduce((acc, root) => acc + count(root), 0);
  }, [roots]);

  if (roots.length === 0 && unassigned.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">No hay empleados activos para mostrar en el organigrama.</p>;
  }

  return (
    <div className="space-y-6">
      {roots.length > 0 && (
        <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="min-w-fit flex flex-col items-center gap-10 py-2">
            {roots.map((root) => (
              <OrgChartBranch
                key={root.employee.id}
                node={root}
                positionById={positionById}
                departmentById={departmentById}
                searchQuery={searchQuery}
                depth={0}
              />
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-400 text-center">{totalInTree} persona(s) con relación jefe-empleado registrada.</p>

      {unassigned.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">Sin jefe ni equipo asignado</p>
          <div className="flex flex-wrap gap-2.5">
            {unassigned.map((employee) => (
              <NodeCard
                key={employee.id}
                employee={employee}
                positionName={positionById.get(employee.position ?? '')?.name ?? 'Sin cargo'}
                departmentName={departmentById.get(employee.department ?? '')?.name ?? ''}
                reportsCount={0}
                highlighted={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

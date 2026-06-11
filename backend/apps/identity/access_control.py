DEFAULT_ROLE_CODE = "CLIENT"
ADMIN_ROLE_CODE = "ADMIN"


ROLE_DEFINITIONS = (
    {
        "code": "ADMIN",
        "name": "Administrador",
        "description": "Acceso total al panel administrativo y de empleados.",
        "is_superuser": True,
        "is_default": False,
    },
    {
        "code": "CLIENT",
        "name": "Cliente",
        "description": "Usuario final que compra productos y consulta sus pedidos.",
        "is_superuser": False,
        "is_default": True,
    },
    {
        "code": "PRO",
        "name": "Cliente PRO",
        "description": "Cliente con beneficios especiales y acceso ampliado al catálogo.",
        "is_superuser": False,
        "is_default": False,
    },
    {
        "code": "SELLER",
        "name": "Vendedor",
        "description": "Rol operativo orientado a ventas y administración comercial.",
        "is_superuser": False,
        "is_default": False,
    },
    {
        "code": "DISTRIBUTOR",
        "name": "Distribuidor",
        "description": "Rol operativo con foco en inventario, despacho y seguimiento.",
        "is_superuser": False,
        "is_default": False,
    },
    {
        "code": "RRHH",
        "name": "Recursos humanos",
        "description": "Gestiona personal, nómina y solicitudes de talento humano.",
        "is_superuser": False,
        "is_default": False,
    },
    {
        "code": "EMPLEADO",
        "name": "Empleado",
        "description": "Empleado general con acceso acotado a módulos internos.",
        "is_superuser": False,
        "is_default": False,
    },
    {
        "code": "PEDIDOS",
        "name": "Pedidos y seguimiento",
        "description": "Encargado de pedidos, guías y seguimiento logístico.",
        "is_superuser": False,
        "is_default": False,
    },
)


COMPONENT_DEFINITIONS = (
    {
        "code": "identity.users",
        "name": "Usuarios",
        "description": "Administración de cuentas de usuario y asignación de roles.",
    },
    {
        "code": "identity.roles",
        "name": "Roles",
        "description": "Configuración de roles del sistema.",
    },
    {
        "code": "identity.components",
        "name": "Componentes",
        "description": "Catálogo de componentes funcionales del sistema.",
    },
    {
        "code": "catalog.management",
        "name": "Catálogo",
        "description": "Gestión de productos, categorías, variantes e imágenes.",
    },
    {
        "code": "customers.management",
        "name": "Clientes",
        "description": "Gestión de clientes, contactos y segmentos.",
    },
    {
        "code": "inventory.management",
        "name": "Inventario",
        "description": "Bodegas, ubicaciones, existencias y movimientos.",
    },
    {
        "code": "employees.management",
        "name": "Empleados",
        "description": "Estructura interna, cargos y expedientes de empleados.",
    },
    {
        "code": "human_resources.management",
        "name": "Recursos humanos",
        "description": "Vacaciones, nómina, asistencia y revisiones de desempeño.",
    },
    {
        "code": "finance.management",
        "name": "Finanzas",
        "description": "Transacciones financieras y facturación.",
    },
    {
        "code": "analytics.management",
        "name": "Analíticas",
        "description": "Paneles, métricas y exportación de reportes.",
    },
    {
        "code": "audit.logs",
        "name": "Auditoría",
        "description": "Registro y consulta de eventos de auditoría.",
    },
    {
        "code": "commerce.orders",
        "name": "Pedidos",
        "description": "Gestión operativa de pedidos y estados de compra.",
    },
    {
        "code": "envios.management",
        "name": "Envíos",
        "description": "Gestión de transportadoras y envíos.",
    },
    {
        "code": "envios.manual_guides",
        "name": "Guías manuales",
        "description": "Registro manual de guías de envío.",
    },
    {
        "code": "envios.tracking",
        "name": "Seguimiento",
        "description": "Consulta y actualización del seguimiento logístico.",
    },
)


def build_default_role_permissions():
    permissions = {
        role["code"]: {} for role in ROLE_DEFINITIONS
    }
    all_component_codes = tuple(component["code"] for component in COMPONENT_DEFINITIONS)

    permissions["ADMIN"] = {
        component_code: {"can_view": True, "can_edit": True}
        for component_code in all_component_codes
    }
    permissions["CLIENT"] = {}
    permissions["PRO"] = {}
    permissions["SELLER"] = {
        "catalog.management": {"can_view": True, "can_edit": True},
        "commerce.orders": {"can_view": True, "can_edit": True},
        "customers.management": {"can_view": True, "can_edit": False},
        "inventory.management": {"can_view": True, "can_edit": False},
        "envios.tracking": {"can_view": True, "can_edit": False},
    }
    permissions["DISTRIBUTOR"] = {
        "inventory.management": {"can_view": True, "can_edit": False},
        "commerce.orders": {"can_view": True, "can_edit": False},
        "envios.tracking": {"can_view": True, "can_edit": False},
    }
    permissions["RRHH"] = {
        "identity.users": {"can_view": True, "can_edit": True},
        "employees.management": {"can_view": True, "can_edit": True},
        "human_resources.management": {"can_view": True, "can_edit": True},
    }
    permissions["EMPLEADO"] = {
        "identity.users": {"can_view": True, "can_edit": False},
        "employees.management": {"can_view": True, "can_edit": False},
    }
    permissions["PEDIDOS"] = {
        "commerce.orders": {"can_view": True, "can_edit": True},
        "inventory.management": {"can_view": True, "can_edit": False},
        "envios.management": {"can_view": True, "can_edit": True},
        "envios.manual_guides": {"can_view": True, "can_edit": True},
        "envios.tracking": {"can_view": True, "can_edit": True},
    }
    return permissions

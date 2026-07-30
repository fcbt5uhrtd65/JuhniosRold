import re
import unicodedata
from datetime import date, datetime
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.employees.infrastructure.models import Branch, Department, Employee, Position


SURTITIENDAS_EMPLOYEES = [
    {
        "document_number": "32580411",
        "full_name": "ERIKA PATRICIA RODRIGUEZ OROZCO",
        "position": "AUXILIAR DE VENTAS",
        "area": "VENTAS",
        "boss": "YOREIMA GALVAN",
        "contract": "TERMINO INDEFINIDO",
        "hire_date": "04 DE SEPTIEMBRE DE 2020",
        "duration": "INDEFINIDO",
        "contract_end": "INDEFINIDO",
        "resume": "SI",
        "arl": "COLPATRIA",
        "pension_fund": "COLFONDOS",
        "compensation_fund": "CAJACOPI",
        "eps": "SALUD TOTAL",
        "entry_exam": "22 DE AGOSTO 2018",
        "periodic_exam": "28 DE SEPTIEMBRE 2020",
    },
    {
        "document_number": "1129516345",
        "full_name": "YAMILE LIZETH IMITOLA TAPIA",
        "position": "ASESORA DE VENTAS",
        "area": "VENTAS",
        "boss": "YOREIMA GALVAN",
        "contract": "TERMINO FIJO A 1 AÑO",
        "hire_date": "25 DE OCTUBRE DE 2016",
        "duration": "1 AÑO",
        "contract_end": "24 DE OCTUBRE DE 2017",
        "resume": "SI",
        "pension_fund": "PROTECCION",
        "compensation_fund": "COMFAMILIAR",
        "eps": "SALUD TOTAL",
        "entry_exam": "21 DE OCTUBRE 2016",
        "periodic_exam": "43833",
    },
    {
        "document_number": "1042250636",
        "full_name": "YENIFER PATRICIA PEREZ SERNA",
        "position": "CAJERO",
        "area": "VENTAS",
        "boss": "YOREIMA GALVAN",
        "contract": "TERMINO FIJO",
        "hire_date": "06 DE FEBRERO 2023",
        "duration": "3 MESES",
        "contract_end": "05 DE MAYO DE 2023",
        "resume": "SI",
        "arl": "COLPATRIA",
        "pension_fund": "PROTECCION",
        "compensation_fund": "CAJACOPI",
        "eps": "SURA",
    },
    {
        "document_number": "1143469994",
        "full_name": "KATHERINE DAYANA SUAREZ MALO",
        "position": "ASESOR DE VENTAS",
        "area": "VNTAS",
        "boss": "YOREIMA GALVAN",
        "contract": "TERMINO FIJO",
        "hire_date": "06 DE DICIEMBRE 2023",
        "duration": "3 MESES",
        "contract_end": "05 DEMARZO DE 2024",
        "resume": "SI",
        "arl": "COLPARIA",
        "pension_fund": "PROTECCION",
        "compensation_fund": "CAJACOPI",
        "eps": "SALUD TOTAL",
    },
    {
        "document_number": "22655400",
        "full_name": "KARINA CASADIEGO",
        "contract": "TERMINO FIJO 1 AÑO",
        "hire_date": "07 DE MARZO DE 2016",
        "duration": "1 AÑO",
        "induction": "NO",
        "data_treatment": "NO",
        "resume": "SI",
        "compensation_fund": "CAJACOPI",
        "entry_exam": "07 DE MARZO 2016",
        "periodic_exam": "28 DE SEPTIEMBRE 2020",
    },
    {
        "document_number": "1082943456",
        "full_name": "LINA HERNANDEZ",
        "position": "ASESORA DE VENTAS",
        "area": "VENTAS",
        "contract": "TERMINO FIJO INFERIOR",
        "hire_date": "09 DE ENERO DE 2026",
        "duration": "3",
    },
    {
        "document_number": "1143140495",
        "full_name": "SANDRA PAOLA ANGULO BARRIOS",
        "position": "ASESOR DE VENTAS",
        "area": "VENTAS",
        "boss": "NELSON GALVAN",
        "contract": "TERMINO FIJO INFERIOR A UN AÑO",
        "hire_date": "01 DE JUNIO DE 2025",
        "duration": "3 MESES",
        "contract_end": "01 DE SEPTIEMBRE DE 2025",
        "induction": "SI",
        "resume": "SI",
        "pension_fund": "PORVENIR",
        "eps": "SALUD TOTAL",
    },
    {
        "document_number": "1129507648",
        "full_name": "JHOANA VISBAL MILANES",
        "position": "ASESOR DE VENTAS",
        "area": "VENTAS",
        "contract": "TERMINO FIJO INFERIOR",
        "hire_date": "19 DE FEBRERO",
        "duration": "3 MESES",
        "contract_end": "19 DE MAYO DE 2026",
    },
    {
        "document_number": "1001875119",
        "full_name": "LILIANA DEL CARMEN TAPIA ESCORCIA",
        "position": "ASESORA DE VENTAS",
        "area": "VENTAS",
        "contract": "TERMINO FIJO",
        "hire_date": "17 DE MARZO 2026",
        "duration": "3 MESES",
        "contract_end": "17 DE JUNIO 2026",
    },
    {
        "document_number": "1002127938",
        "full_name": "ESNEIDER JESUS REALES ARAGON",
        "position": "AUXILIAR DE DESPACHO",
        "area": "BODEGA",
        "boss": "JEISON CUELLO",
        "contract": "TERMINO FIJO",
        "hire_date": "22 DE JULIO DE 2024",
        "duration": "3 MESES",
        "contract_end": "21 DE COTUBRE DE 2025",
        "resume": "SI",
        "arl": "COLPATRIA",
        "pension_fund": "PORVENIR",
        "compensation_fund": "CAJACOPI",
        "eps": "NUEVA EPS",
    },
    {
        "document_number": "1045681222",
        "full_name": "JESUS DAVID LEON CARDENAS",
        "position": "OPERARIO DE CARGUE Y DESCARGUE",
        "area": "BODEGA",
        "boss": "JEISON CUELLO",
        "contract": "TERMINO FIJO INFERIOR",
        "hire_date": "03 DE ABRIL 2025",
        "duration": "2 MESES",
        "contract_end": "02 DE JULIO DE 2025",
        "induction": "SI",
        "resume": "SI",
    },
    {
        "document_number": "1007767449",
        "full_name": "JULIO MIGUEL PEREZ BURGOS",
        "position": "AUXILIAR DE BODEGA",
        "area": "BODEGA",
        "boss": "JEISON CUELLO",
        "contract": "TERMINO FIJO",
        "hire_date": "18 DE DICEMBRE DE 2023",
        "duration": "3 MESES",
        "contract_end": "17 DE MARZO DE 2024",
        "data_treatment": "SI",
        "resume": "SI",
        "note": "En el Excel dice: ES DE PJR PERO ESTA AQUI; carpeta fisica en PJR.",
    },
    {
        "document_number": "1048066665",
        "full_name": "ELIAS JOSE CAMACHO GONZALEZ",
        "position": "AUXILIAR DE DESPACHO",
        "contract": "TERMINO FIJO INFERIOR",
        "hire_date": "25 DE MARZO DE 2026",
        "duration": "3 MESES",
        "contract_end": "25 DE JUNIO DE 2026",
    },
    {
        "document_number": "1001856404",
        "full_name": "JESUS ANGULO OROZCO",
        "position": "COORDINADOR BODEGA",
        "contract": "TERMINO FIJO INFERIOR",
        "hire_date": "03 DE JUNIO DE 2026",
        "duration": "3 MESES",
        "contract_end": "03 DE AGOSTO DE 2026",
    },
    {
        "document_number": "1045678468",
        "full_name": "SAUL PEREZ CUADRADO",
        "position": "AUXILIAR DE BODEGA",
        "area": "BODEGA",
        "contract": "TERMINO FIJO INFERIOR",
        "hire_date": "21 DE OCTUBRE DE 2025",
        "duration": "3 MESES",
        "contract_end": "21 DE ENERO DE 2026",
    },
    {
        "document_number": "1042454140",
        "full_name": "ALEXANDER FERNANDEZ OROZCO",
        "position": "AUXILIAR DE DESPACHO",
        "area": "BODEGA",
        "boss": "JEISON CUELLO",
        "contract": "TERMINO FIJO",
        "hire_date": "16 DE ENERO 2024",
        "duration": "3 MESES",
        "contract_end": "15 DE ABRIL DE 2024",
        "resume": "SI",
        "arl": "COLPATRIA",
        "pension_fund": "PROTECCION",
        "eps": "SALUD TOTAL",
    },
    {
        "document_number": "1049348207",
        "full_name": "ROBERTO ESPAÑA MARTINEZ",
        "position": "AUXILIAR DE BODEGA",
        "area": "BODEGA",
        "contract": "TERMINO FIJO",
        "hire_date": "01 DE DICIEMBRE 2025",
        "duration": "3 MESES",
        "contract_end": "01 DE MARZO 2026",
    },
    {
        "document_number": "22742584",
        "full_name": "MAILEDYS MARIA CONTRERAS DE LA CRUZ",
        "position": "AUXILIAR CONTABLE",
        "area": "ADMINISTRATIVA",
        "boss": "YOREIMA GALVAN",
        "contract": "TERMINO FIJO A 1 AÑO",
        "hire_date": "3 DE ABRIL 2017",
        "duration": "1 AÑO",
        "contract_end": "2 DE ABRIL DE 2018",
        "resume": "SI",
        "arl": "COLPATRIA",
        "pension_fund": "PROTECCION",
        "compensation_fund": "CAJACOPI",
        "eps": "SALUD TOTAL",
    },
    {
        "document_number": "1143157167",
        "full_name": "FABIAN DE JESUS RODRIGUEZ LASTRE",
        "position": "AUXILIAR CONTABLE",
        "area": "BODEGA",
        "contract": "TERMINO FIJO INFERIOR",
        "hire_date": "24 SEPTIEMBRE DE 2020",
        "duration": "3 MESES",
        "contract_end": "23 DE DICIEMBRE 2020",
    },
    {
        "document_number": "1066001261",
        "full_name": "HELMER BOLAÑO MONSALVE",
        "position": "AUXILIAR DE DESPACHO",
        "area": "ADMINISTRATIVO",
        "contract": "TERMINO FIJO",
        "hire_date": "09 DE ENERO DE 2026",
        "duration": "3 MESES",
        "contract_end": "09 DE ABRIL 2026",
    },
    {
        "document_number": "1090409976",
        "full_name": "ISNARDO GALVAN PEÑARANDA",
        "position": "ADMINISTRADOR",
        "area": "ADMINISTRATIVO",
        "boss": "YOREIMA GALVAN",
        "contract": "TERMINO FIJO",
        "hire_date": "26 DE FEBRERO 2025",
        "duration": "6 MESES",
        "contract_end": "25 DE AGOSTO 2025",
        "resume": "SI",
        "arl": "POSITIVA",
        "pension_fund": "PROTECCION",
        "compensation_fund": "CAJACOPI",
        "eps": "SALUD TOTAL",
    },
]

SPANISH_MONTHS = {
    "enero": 1,
    "febrero": 2,
    "marzo": 3,
    "demarzo": 3,
    "abril": 4,
    "mayo": 5,
    "junio": 6,
    "julio": 7,
    "agosto": 8,
    "septiembre": 9,
    "setiembre": 9,
    "octubre": 10,
    "cotubre": 10,
    "noviembre": 11,
    "diciembre": 12,
    "dicembre": 12,
}

DEPARTMENT_FIXES = {
    "vntas": "VENTAS",
    "ventas": "VENTAS",
    "bodega": "BODEGA",
    "administrativa": "ADMINISTRATIVA",
    "administrativo": "ADMINISTRATIVA",
}


def normalize_key(value):
    text = "" if value is None else str(value)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = re.sub(r"[^a-zA-Z0-9]+", " ", text).strip().lower()
    return re.sub(r"\s+", " ", text)


def clean_text(value):
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return re.sub(r"\s+", " ", str(value)).strip()


def clean_document(value):
    text = clean_text(value)
    if not text:
        return ""
    digits = re.sub(r"\D+", "", text)
    return digits if len(digits) >= 5 else ""


def clean_name(value):
    text = clean_text(value)
    text = re.sub(r"\([^)]*\)", "", text)
    text = re.split(r"\s+CARPETA\s+", text, maxsplit=1, flags=re.IGNORECASE)[0]
    text = re.sub(r"\s+", " ", text).strip(" -")
    return text.title()


def split_full_name(full_name):
    parts = clean_name(full_name).split()
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    if len(parts) == 2:
        return parts[0], parts[1]
    if len(parts) == 3:
        return " ".join(parts[:2]), parts[2]
    return " ".join(parts[:2]), " ".join(parts[2:])


def clean_catalog_name(value):
    text = clean_text(value).strip()
    if not text:
        return ""
    normalized = normalize_key(text)
    return DEPARTMENT_FIXES.get(normalized, text.upper())


def parse_date(value):
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    text = normalize_key(value)
    if not text or "indefinido" in text:
        return None

    for fmt in ("%Y %m %d", "%d %m %Y", "%d %m %y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass

    match = re.search(r"(\d{1,2})\s+de?\s*([a-z]+)\s+(?:de\s+)?(\d{4})", text)
    if not match:
        match = re.search(r"(\d{1,2})\s+([a-z]+)\s+(?:de\s+)?(\d{4})", text)
    if not match:
        return None

    day = int(match.group(1))
    month = SPANISH_MONTHS.get(match.group(2))
    year = int(match.group(3))
    if not month:
        return None
    try:
        return date(year, month, day)
    except ValueError:
        return None


def map_contract_type(value):
    text = normalize_key(value)
    if not text:
        return Employee.ContractType.INDEFINITE
    if "indef" in text:
        return Employee.ContractType.INDEFINITE
    if "prestacion" in text or "servicio" in text:
        return Employee.ContractType.SERVICES
    if "aprendiz" in text:
        return Employee.ContractType.APPRENTICESHIP
    if "practica" in text:
        return Employee.ContractType.INTERNSHIP
    if "fijo" in text or "termino" in text:
        return Employee.ContractType.FIXED_TERM
    return Employee.ContractType.OTHER


def find_branch(branch_name):
    target = normalize_key(branch_name)
    branches = list(Branch.all_objects.filter(deleted_at__isnull=True))

    exact_matches = [
        branch
        for branch in branches
        if normalize_key(branch.name) == target or normalize_key(branch.code) == target
    ]
    if exact_matches:
        return exact_matches[0]

    partial_matches = [
        branch
        for branch in branches
        if target in normalize_key(branch.name) or target in normalize_key(branch.code)
    ]
    if len(partial_matches) == 1:
        return partial_matches[0]
    if len(partial_matches) > 1:
        names = ", ".join(f"{branch.code} - {branch.name}" for branch in partial_matches)
        raise CommandError(f"Hay varias sedes parecidas a '{branch_name}': {names}. Usa --branch con el nombre exacto.")

    available = ", ".join(f"{branch.code} - {branch.name}" for branch in branches[:20])
    raise CommandError(f"No encontre la sede '{branch_name}'. Sedes disponibles: {available or 'ninguna'}.")


def find_department(name, create_catalogs):
    cleaned_name = clean_catalog_name(name)
    if not cleaned_name:
        return None

    for department in Department.objects.all():
        if normalize_key(department.name) == normalize_key(cleaned_name):
            return department

    if create_catalogs:
        return Department.objects.create(name=cleaned_name, is_active=True)
    return None


def find_position(name, department, create_catalogs):
    cleaned_name = clean_catalog_name(name)
    if not cleaned_name or department is None:
        return None

    for position in Position.objects.filter(department=department):
        if normalize_key(position.name) == normalize_key(cleaned_name):
            return position

    if create_catalogs:
        return Position.objects.create(department=department, name=cleaned_name, is_active=True)
    return None


def build_work_observations(item):
    labels = (
        ("boss", "Jefe inmediato"),
        ("duration", "Duracion de contrato"),
        ("contract_end", "Fecha de finalizacion"),
        ("induction", "Induccion"),
        ("data_treatment", "Tratamiento de datos"),
        ("resume", "Hoja de vida"),
        ("entry_exam", "Examen de ingreso"),
        ("periodic_exam", "Examen periodico"),
        ("signed_contract", "Contrato"),
        ("note", "Nota"),
    )
    lines = ["Datos importados del Excel CARPETAS TRABAJADORES ACTIVOS SURTITIENDAS."]
    for key, label in labels:
        value = clean_text(item.get(key))
        if value:
            lines.append(f"{label}: {value}")
    return "\n".join(lines)


class Command(BaseCommand):
    help = "Carga los empleados del Excel de Surtitiendas ya incluidos en este script."

    def add_arguments(self, parser):
        parser.add_argument(
            "--branch",
            default="Surtitiendas",
            help="Nombre o codigo de la sede existente que se asignara a los empleados.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Muestra lo que haria sin guardar cambios.",
        )
        parser.add_argument(
            "--no-create-catalogs",
            action="store_true",
            help="No crea areas ni cargos que falten.",
        )
        parser.add_argument(
            "--only-create",
            action="store_true",
            help="No actualiza empleados existentes; solo crea los que no existan por identificacion.",
        )

    def handle(self, *args, **options):
        branch = find_branch(options["branch"])
        dry_run = options["dry_run"]
        create_catalogs = not options["no_create_catalogs"]
        only_create = options["only_create"]

        created_count = 0
        updated_count = 0
        skipped_count = 0

        with transaction.atomic():
            for index, item in enumerate(SURTITIENDAS_EMPLOYEES, start=1):
                document_number = clean_document(item["document_number"])
                first_name, last_name = split_full_name(item["full_name"])
                department = find_department(item.get("area"), create_catalogs)
                position = find_position(item.get("position"), department, create_catalogs)
                hire_date = parse_date(item.get("hire_date"))

                incoming = {
                    "document_type": Employee.DocumentType.CC,
                    "document_number": document_number,
                    "first_name": first_name,
                    "last_name": last_name,
                    "status": Employee.Status.ACTIVE,
                    "branch": branch,
                    "contract_type": map_contract_type(item.get("contract")),
                    "employment_type": Employee.EmploymentType.EMPLOYEE,
                    "profile_status": Employee.ProfileStatus.INCOMPLETE,
                    "arl": clean_text(item.get("arl")),
                    "pension_fund": clean_text(item.get("pension_fund")),
                    "compensation_fund": clean_text(item.get("compensation_fund")),
                    "eps": clean_text(item.get("eps")),
                    "work_observations": build_work_observations(item),
                }
                if hire_date:
                    incoming["hire_date"] = hire_date
                if department:
                    incoming["department"] = department
                if position:
                    incoming["position"] = position

                employee = Employee.all_objects.filter(document_number=document_number).first()
                if employee is None:
                    if not dry_run:
                        Employee.objects.create(**incoming)
                    created_count += 1
                    self.stdout.write(f"CREAR {index:02d}: {document_number} - {first_name} {last_name}")
                    continue

                if only_create:
                    skipped_count += 1
                    self.stdout.write(f"OMITIR {index:02d}: {document_number} ya existe")
                    continue

                update_fields = []
                for field, value in incoming.items():
                    if value in ("", None) and field not in {"branch", "status"}:
                        continue
                    if field == "profile_status" and employee.profile_status not in (Employee.ProfileStatus.DRAFT, ""):
                        continue
                    if field == "work_observations" and clean_text(employee.work_observations):
                        continue
                    if getattr(employee, field) != value:
                        setattr(employee, field, value)
                        update_fields.append(field)

                if employee.deleted_at:
                    employee.deleted_at = None
                    update_fields.append("deleted_at")

                if update_fields:
                    if not dry_run:
                        employee.save(update_fields=tuple(set(update_fields + ["updated_at"])))
                    updated_count += 1
                    self.stdout.write(f"ACTUALIZAR {index:02d}: {document_number} - {first_name} {last_name}")
                else:
                    skipped_count += 1
                    self.stdout.write(f"OK {index:02d}: {document_number} sin cambios")

            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(
            self.style.SUCCESS(
                f"Listo. Sede: {branch.name}. Datos incluidos: {len(SURTITIENDAS_EMPLOYEES)}. "
                f"Creados: {created_count}, actualizados: {updated_count}, omitidos: {skipped_count}."
                + (" (dry-run, no se guardo nada)" if dry_run else "")
            )
        )

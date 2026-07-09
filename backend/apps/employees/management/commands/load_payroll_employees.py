from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.employees.infrastructure.models import Employee

# cedula, nombre, apellido, banco, numero_cuenta, salario
EMPLOYEES_DATA = [
    ("1143159318", "Alexander", "Asis", "DAVIVIENDA", "0550026000785035", Decimal("1750905")),
    ("1001854470", "Andres", "Garcia", "DAVIVIENDA", "0550026000784699", Decimal("1750905")),
    ("1042357159", "Alvaro", "Guerra", "DAVIVIENDA", "0550026000784814", Decimal("1750905")),
    ("1051737004", "Arturo", "Martinez", "DAVIVIENDA", "0550026000784947", Decimal("1750905")),
    ("1047225089", "Catalino", "Jimenez", "DAVIVIENDA", "0550026000784921", Decimal("1750905")),
    ("1044422993", "Cristina", "Montes", "DAVIVIENDA", "0550488453315977", Decimal("1750905")),
    ("1001889041", "Daniel", "Arias", "DAVIVIENDA", "0550026000784731", Decimal("1750905")),
    ("1046874854", "Daniel", "Alonso", "DAVIVIENDA", "0550026000784913", Decimal("1750905")),
    ("1047041315", "Daniel", "Blanco", "DAVIVIENDA", "0550488454623635", Decimal("1750905")),
    ("3725943", "Dario", "Bolivar", "DAVIVIENDA", "0550026000784590", Decimal("1750905")),
    ("1044608559", "Dick", "Sajer", "DAVIVIENDA", "0550026000784871", Decimal("1750905")),
    ("1045696887", "Diego", "Aranda", "DAVIVIENDA", "0550488454860674", Decimal("1750905")),
    ("1041870084", "Dreilis", "Bravo", "DAVIVIENDA", "0550488455764529", Decimal("1750905")),
    ("1045679021", "Edgardo", "Villa", "DAVIVIENDA", "0550026000784897", Decimal("1750905")),
    ("5031302", "Euclides", "Ospino", "DAVIVIENDA", "0550026000784608", Decimal("1750905")),
    ("72184012", "Freddy", "Mendivil", "DAVIVIENDA", "0550026000784640", Decimal("1750905")),
    ("1043144387", "Gheiger", "Vasquez", "DAVIVIENDA", "0570488473742762", None),
    ("77157991", "Guillermo", "Nunez", "DAVIVIENDA", "0550026000784673", Decimal("1750905")),
    ("1103948296", "Isaac", "Tovar", "DAVIVIENDA", "488472857371", Decimal("1750905")),
    ("1001887072", "Jeremy", "Ospino", "DAVIVIENDA", "0550026000784723", Decimal("1750905")),
    ("72137426", "Jesus", "Vega", "DAVIVIENDA", "0550026000784632", Decimal("1750905")),
    ("1118832886", "Jesus", "Ruiz", "DAVIVIENDA", "0570236070257449", Decimal("1750905")),
    ("1007893761", "Jhonaikel", "De Arco", "DAVIVIENDA", "0550488454856581", Decimal("1750905")),
    ("1003230473", "Jhonny", "Barreto", "DAVIVIENDA", "0550026000784764", Decimal("1750905")),
    ("1001944440", "Jorge", "Charris", "DAVIVIENDA", "0550026000784749", Decimal("2000000")),
    ("8795024", "Jose", "Medina", "DAVIVIENDA", "0550488452869180", Decimal("1750905")),
    ("1045716879", "Jose", "Thomas", "DAVIVIENDA", "0550026000784905", Decimal("1750905")),
    ("1042432851", "Jose", "Altamiranda", "DAVIVIENDA", "0550488454133999", Decimal("1750905")),
    ("1042849701", "Joseph", "Pacheco", "DAVIVIENDA", "0550026000784830", Decimal("1750905")),
    ("1007767449", "Julio", "Perez", "DAVIVIENDA", "0550026000784798", Decimal("1750905")),
    ("55312795", "Karen", "Ochoa", "DAVIVIENDA", "0550026000784624", Decimal("1750905")),
    ("1042450038", "Kevin", "Monsalve", "DAVIVIENDA", "0550488449679460", Decimal("1750905")),
    ("72294048", "Leonardo", "Mendoza", "DAVIVIENDA", "0550026000784657", Decimal("1750905")),
    ("1069985496", "Luis", "Beltran", "DAVIVIENDA", "0550026000784962", Decimal("1750905")),
    ("1124076336", "Maria", "Guevara", "DAVIVIENDA", "0550026000790555", Decimal("1750905")),
    ("88283994", "Nelson", "Galvan", "DAVIVIENDA", "026000534698", Decimal("4000000")),
    ("1047041932", "Nicely", "Meza", "DAVIVIENDA", "0550488457884069", Decimal("1750905")),
    ("1042978117", "Obeida", "Avila", "DAVIVIENDA", "0550026000784848", Decimal("1750905")),
    ("1044428040", "Oscar", "Mejia", "DAVIVIENDA", "0550026000784863", Decimal("1750905")),
    ("1006617324", "Osmar", "Mendoza", "DAVIVIENDA", "0550026000784772", Decimal("1750905")),
    ("1007123231", "Paola", "Araujo", "DAVIVIENDA", "0550026000784780", Decimal("2000000")),
    ("1129492171", "Rafael", "Utria", "DAVIVIENDA", "0550026000784996", Decimal("1750905")),
    ("1001855623", "Samuel", "Fernandez", "DAVIVIENDA", "0550026000784707", Decimal("1750905")),
    ("1140837296", "Santander", "Mendoza", "DAVIVIENDA", "0550026000785027", Decimal("1750905")),
    ("1234892707", "Sebastian", "Borelly", "DAVIVIENDA", "0570488472565057", Decimal("1750905")),
    ("32612502", "Shirley", "Jimenez", "DAVIVIENDA", "0570488470997930", Decimal("1750905")),
    ("1002030717", "Sneyder", "Gonzalez", "DAVIVIENDA", "0550488455763893", Decimal("1750905")),
    ("1001899022", "Sofia", "Bertel", "DAVIVIENDA", "488449112892", Decimal("2300000")),
    ("1129535864", "Sony", "Castillo", "DAVIVIENDA", "0550026000785001", Decimal("1750905")),
    ("1048224885", "Tomas", "Munoz", "DAVIVIENDA", "0550026000784939", Decimal("1750905")),
    ("1193592708", "Valentina", "Padilla", "DAVIVIENDA", "488454855450", Decimal("3000000")),
    ("1129504184", "William", "Rodelo", "DAVIVIENDA", "0550488451303512", Decimal("1750905")),
    ("1002162884", "Wilmer", "Martinez", "DAVIVIENDA", "0550488444115213", Decimal("1750905")),
    ("1044613118", "Yesid", "Castro", "DAVIVIENDA", "0550026000784889", Decimal("1750905")),
    ("1143271306", "Yustin", "Arroyo", "DAVIVIENDA", "0550488455456621", Decimal("1750905")),
    ("12598345", "Alex Alfonso", "Chamorro", "BANCOLOMBIA", "12035270807", Decimal("1750905")),
    ("73580159", "Gerson Palencia", "Camargo", "NEQUI", "3008837022", Decimal("1850000")),
    ("18879993", "Hector Enrique", "Blanco Marquez", "NEQUI", "3145613511", Decimal("1750905")),
    ("1043662002", "Jose Alexander", "Ochoa Leon", "NEQUI", "3008217125", Decimal("2000000")),
    ("1001876893", "Jose David", "Sandolval Galvan", "NEQUI", "3024565627", Decimal("1750905")),
    ("1192767960", "Nelson Juhnios", "Galvan", "BANCOLOMBIA", "77000033564", Decimal("1750905")),
    ("1001855028", "Neydi Galvan", "Escorcia", "BANCOLOMBIA", "91219220516", Decimal("1950000")),
    ("1143140495", "Sandra Paola", "Angulo Barrios", "BANCOLOMBIA", "47776581441", Decimal("1750905")),
    ("1129507437", "Orlando", "Florez", "BANCOLOMBIA", "8138408192", Decimal("1750905")),
    ("1090409976", "Isnardo", "Galvan", "NEQUI", "3012828284", Decimal("1750905")),
    ("1002094060", "Karolay Torregrosa", "Montero", "BANCOLOMBIA", "91220328681", Decimal("1750905")),
]


class Command(BaseCommand):
    help = (
        "Carga o actualiza empleados (banco, cuenta y salario base) a partir del "
        "listado de nomina, haciendo match por numero de documento."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Muestra lo que se haria sin escribir en la base de datos.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        created_count = 0
        updated_count = 0

        with transaction.atomic():
            for document_number, first_name, last_name, banco, numero_cuenta, salario in EMPLOYEES_DATA:
                defaults = {
                    "first_name": first_name,
                    "last_name": last_name,
                    "bank_name": banco,
                    "bank_account_number": numero_cuenta,
                    "bank_account_holder": f"{first_name} {last_name}".strip(),
                    "bank_account_holder_document": document_number,
                }
                if salario is not None:
                    defaults["base_salary"] = salario

                employee = Employee.all_objects.filter(document_number=document_number).first()

                if employee is None:
                    if not dry_run:
                        Employee.objects.create(
                            document_type=Employee.DocumentType.CC,
                            document_number=document_number,
                            profile_status=Employee.ProfileStatus.INCOMPLETE,
                            status=Employee.Status.ACTIVE,
                            base_salary=salario or Decimal("0"),
                            **{k: v for k, v in defaults.items() if k != "base_salary"},
                        )
                    created_count += 1
                    self.stdout.write(f"CREAR  {document_number} - {first_name} {last_name}")
                else:
                    if not dry_run:
                        for field, value in defaults.items():
                            setattr(employee, field, value)
                        employee.save(update_fields=list(defaults.keys()) + ["updated_at"])
                    updated_count += 1
                    self.stdout.write(f"ACTUALIZAR {document_number} - {first_name} {last_name}")

            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS(
            f"Listo. Creados: {created_count}, actualizados: {updated_count}."
            + (" (dry-run, no se guardo nada)" if dry_run else "")
        ))

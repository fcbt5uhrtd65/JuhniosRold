"""Parser puro del archivo plano exportado por el reloj biométrico.

Formato observado (una marcación por línea, separada por tabs):

    <código_numérico>\t<fecha_hora "YYYY-MM-DD HH:MM:SS">\t<col3>\t<col4>\t<col5>\t<col6>

Ejemplo real:
    610\t2021-12-24 18:02:38\t1\t0\t1\t0
     15\t2021-12-24 18:02:45\t1\t0\t1\t0

El significado de las columnas 3-6 no está confirmado (siempre se han visto
como "1 0 1 0" en las muestras disponibles) — este parser las trata como
datos opacos: se conservan tal cual como texto, sin interpretarlas.

Función pura, sin dependencia de Django models — el resultado se usa para
crear RawBiometricPunch en el caso de uso ImportBiometricFile."""

import re
from datetime import datetime
from io import IOBase

# Distintos modelos/firmwares de reloj biométrico exportan la fecha/hora en
# formatos ligeramente distintos (con/sin segundos, separador '/' en vez de
# '-', año al final). Se intentan en orden hasta que uno funcione, en vez de
# asumir un único formato rígido — así una exportación de otro equipo no
# tumba la importación completa.
_TIMESTAMP_FORMATS = (
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%Y/%m/%d %H:%M:%S",
    "%d/%m/%Y %H:%M:%S",
    "%d-%m-%Y %H:%M:%S",
)

_MULTI_SPACE_RE = re.compile(r" {2,}")


class BiometricFileParseError(Exception):
    """Error irrecuperable al parsear el archivo (formato completamente
    inválido, no simplemente filas sueltas mal formadas)."""


def _parse_timestamp(raw: str):
    for fmt in _TIMESTAMP_FORMATS:
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return None


def _decode(raw_content) -> str:
    if isinstance(raw_content, bytes):
        for encoding in ("utf-8", "latin-1"):
            try:
                return raw_content.decode(encoding)
            except UnicodeDecodeError:
                continue
        raise BiometricFileParseError("No se pudo decodificar el archivo (codificación desconocida).")
    return raw_content


def parse_biometric_file(file_obj) -> list[dict]:
    """Parsea el archivo plano y devuelve una lista de dicts, uno por línea
    válida, con las claves: biometric_code, punched_at (datetime),
    raw_col3..raw_col6 (str), raw_line (str), y opcionalmente "error" (str)
    para líneas que no se pudieron parsear — estas últimas se incluyen para
    que el llamador pueda contarlas/reportarlas, no se descartan en
    silencio."""
    if isinstance(file_obj, IOBase) or hasattr(file_obj, "read"):
        if hasattr(file_obj, "seek"):
            file_obj.seek(0)
        raw_content = file_obj.read()
    else:
        raw_content = file_obj

    content = _decode(raw_content)
    lines = content.splitlines()

    rows: list[dict] = []
    for line_number, line in enumerate(lines, start=1):
        stripped = line.strip("\r\n")
        if not stripped.strip():
            continue

        columns = stripped.split("\t")
        if len(columns) < 2:
            # Algunas exportaciones usan espacios múltiples en vez de tabs reales.
            columns = _MULTI_SPACE_RE.split(stripped.strip())

        if len(columns) < 2:
            rows.append({
                "line_number": line_number,
                "raw_line": stripped,
                "error": "La línea no tiene el número mínimo de columnas (código y fecha/hora).",
            })
            continue

        biometric_code = columns[0].strip()
        timestamp_raw = columns[1].strip()
        if len(columns) >= 3 and re.match(r"^\d{2}:\d{2}(:\d{2})?$", columns[2].strip()):
            # Fecha y hora en columnas separadas ("2021-12-24" \t "18:02:38").
            timestamp_raw = f"{timestamp_raw} {columns[2].strip()}"
            columns = [columns[0], timestamp_raw] + columns[3:]

        punched_at = _parse_timestamp(timestamp_raw)
        if punched_at is None:
            rows.append({
                "line_number": line_number,
                "raw_line": stripped,
                "error": f"Fecha/hora inválida: '{timestamp_raw}'.",
            })
            continue

        if not biometric_code:
            rows.append({
                "line_number": line_number,
                "raw_line": stripped,
                "error": "Código de empleado vacío.",
            })
            continue

        rest = columns[2:6]
        rest += [""] * (4 - len(rest))

        rows.append({
            "line_number": line_number,
            "biometric_code": biometric_code,
            "punched_at": punched_at,
            "raw_col3": rest[0],
            "raw_col4": rest[1],
            "raw_col5": rest[2],
            "raw_col6": rest[3],
            "raw_line": stripped,
        })

    return rows

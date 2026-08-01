from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

from bolty_switch.constants import DEFAULT_TASKS
from bolty_switch.services.windows_tasks import audit_task_actions, plan_task


def build_report() -> dict[str, object]:
    actions = [task.action for task in DEFAULT_TASKS]
    audit = audit_task_actions(actions)
    executables = {
        name: bool(shutil.which(name)) if sys.platform == "win32" else None
        for name in (
            "powershell.exe",
            "explorer.exe",
            "rundll32.exe",
            "shutdown.exe",
            "taskmgr.exe",
            "calc.exe",
            "control.exe",
            "mmc.exe",
        )
    }
    task_rows = [
        {
            "name": task.name_es,
            "action": task.action,
            "kind": plan_task(task.action).kind,
            "requires_admin": plan_task(task.action).requires_admin,
        }
        for task in DEFAULT_TASKS
    ]
    ok = not audit["missing"] and not audit["duplicates"] and int(audit["total"]) == 70
    return {
        "ok": ok,
        "platform": sys.platform,
        "tasks": task_rows,
        "audit": audit,
        "executables": executables,
        "python_dependencies_required_by_tasks": [],
        "notes": [
            "El volumen usa teclas multimedia nativas de Windows; pycaw/comtypes no son necesarios.",
            "Wi-Fi y Bluetooth pueden requerir permisos de administrador según el controlador y la política de Windows.",
            "Brillo solo funciona en pantallas que exponen el control WMI de Windows.",
        ],
    }


def print_human(report: dict[str, object]) -> None:
    audit = report["audit"]
    print("=== Bolty Switch - Diagnóstico de las 70 tareas ===")
    print(f"Estado: {'CORRECTO' if report['ok'] else 'ERRORES DETECTADOS'}")
    print(f"Tareas: {audit['total']} | únicas: {audit['unique']}")
    print(f"No compatibles: {', '.join(audit['missing']) if audit['missing'] else 'ninguna'}")
    print(f"Duplicadas: {', '.join(audit['duplicates']) if audit['duplicates'] else 'ninguna'}")
    print("Dependencias Python obligatorias para Tareas: ninguna")
    if sys.platform == "win32":
        print("Componentes de Windows:")
        for name, available in report["executables"].items():
            print(f"  {'OK' if available else 'FALTA'}  {name}")
    else:
        print("Prueba estática completada. La ejecución real requiere Windows.")
    print("\nAcciones:")
    for row in report["tasks"]:
        admin = " · administrador" if row["requires_admin"] else ""
        print(f"  OK  {row['name']} [{row['action']}] -> {row['kind']}{admin}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Audita todas las tareas integradas de Bolty Switch sin ejecutarlas.")
    parser.add_argument("--json", action="store_true", help="Muestra el informe en JSON.")
    parser.add_argument("--output", type=Path, help="Guarda el informe JSON en un archivo.")
    args = parser.parse_args()
    report = build_report()
    if args.output:
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print_human(report)
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

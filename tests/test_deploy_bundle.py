import unittest
from pathlib import Path


class DeployBundleTests(unittest.TestCase):
    def test_wasmer_bundle_includes_all_root_python_modules(self):
        project_root = Path(__file__).resolve().parents[1]
        script = (project_root / "scripts" / "deploy-wasmer-flask.mjs").read_text()

        self.assertIn('entry.name.endsWith(".py")', script)
        self.assertIn("pythonModules.map", script)
        self.assertTrue((project_root / "openapi_spec.py").is_file())


if __name__ == "__main__":
    unittest.main()

import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).parents[1] / "integrations" / "hermes" / "portfolio-agent" / "scripts" / "portfolio_api.py"
SPEC = importlib.util.spec_from_file_location("portfolio_api", SCRIPT)
portfolio_api = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(portfolio_api)


class PortfolioSkillTests(unittest.TestCase):
    def test_normalizes_ticker(self) -> None:
        self.assertEqual(portfolio_api.normalize_ticker(" googl.us "), "GOOGL.US")

    def test_rejects_unsafe_ticker(self) -> None:
        with self.assertRaises(ValueError):
            portfolio_api.normalize_ticker("AAPL/../../secret")

    def test_context_maps_to_owner_endpoint(self) -> None:
        args = portfolio_api.build_parser().parse_args(["context"])
        with patch.object(portfolio_api, "api_request", return_value={"portfolio": {}}) as request:
            self.assertEqual(portfolio_api.execute(args), {"portfolio": {}})
        request.assert_called_once_with("GET", "/v1/portfolio/context")


if __name__ == "__main__":
    unittest.main()

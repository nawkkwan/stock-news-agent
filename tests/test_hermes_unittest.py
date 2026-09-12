import unittest

from apps.hermes.bot import markdown_value, split_message


class HermesFormattingTests(unittest.TestCase):
    def test_formats_structured_agent_output(self) -> None:
        rendered = markdown_value({"summary": "done", "risks": ["one", "two"]})
        self.assertIn("**Summary:** done", rendered)
        self.assertIn("- one", rendered)

    def test_splits_long_discord_messages(self) -> None:
        chunks = split_message("a" * 3900)
        self.assertEqual(len(chunks), 3)
        self.assertTrue(all(len(chunk) <= 1900 for chunk in chunks))


if __name__ == "__main__":
    unittest.main()

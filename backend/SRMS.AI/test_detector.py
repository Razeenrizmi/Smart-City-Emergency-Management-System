import unittest
import config as cfg
from detector import (
    _validate_plate_format,
    _normalize_plate_key,
    _format_plate,
    _plate_similarity,
    _merge_ocr_variants,
    _score_plate_candidate,
)


class TestAIDetector(unittest.TestCase):

    def test_plate_format_validation(self):
        # Valid Sri Lankan & standard formats
        self.assertTrue(_validate_plate_format("CCA 2101"))
        self.assertTrue(_validate_plate_format("WP CA-1234"))
        self.assertTrue(_validate_plate_format("CAD 5678"))

        # Invalid / garbage patterns
        self.assertFalse(_validate_plate_format("GARBAGE"))
        self.assertFalse(_validate_plate_format("POLICE"))
        self.assertFalse(_validate_plate_format("STOP"))
        self.assertFalse(_validate_plate_format("AI"))

    def test_normalize_and_format_plate(self):
        self.assertEqual(_normalize_plate_key("cca-2101"), "CCA2101")
        self.assertEqual(_format_plate("CCA2101"), "CCA 2101")

    def test_ocr_variants_merge(self):
        # Confusions like 4 -> A, 0 -> O
        merged = _merge_ocr_variants("4B0")
        self.assertEqual(merged, "ABO")

    def test_plate_similarity(self):
        self.assertEqual(_plate_similarity("CCA2101", "CCA2101"), 0)
        self.assertEqual(_plate_similarity("CCA2101", "CCA2102"), 1)

    def test_config_as_dict(self):
        config_dict = cfg.as_dict()
        self.assertIn("targetAiFps", config_dict)
        self.assertIn("confidenceThreshold", config_dict)
        self.assertEqual(config_dict["targetAiFps"], cfg.TARGET_AI_FPS)


if __name__ == "__main__":
    unittest.main()

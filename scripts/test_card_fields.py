import unittest

from scripts.card_fields import apply_model_fields, classify_locally, printed_email
from scripts.read_cards import choose_engine, score_vision

SUPER = """SuperPower
邵春雨
业务经理
超力源
18575217885
一电控系统专家
惠州市超力源科技有限公司
Huizhou Superpower Technology Co.,LTD
惠州市仲恺高新区潼侨镇黄屋路1号超力源科技园
cyshao@superpowertech.com
www.superpowertech.com
www.sz-supower.com.cn
"""

YEEDA = """YEEDA
苏州怡达控股集团有限公司
Suzhou Yeeda Holdings Group Limited
朱丹萍
销售经理
集团总部：苏州工业园区金浦路11号
苏州怡达新能源科技有限公司
制造中心：苏州市相城区凤北荡路168号
怡达电气（苏州）有限公司
215123
salesa05@dingtalk.com
18068009705
"""


class CardFieldsTest(unittest.TestCase):
    def test_missing_paddle_uses_ocrmac(self) -> None:
        self.assertEqual(choose_engine(False, "ocrmac"), "ocrmac")
        self.assertEqual(choose_engine(True, "ocrmac"), "paddleocr")
        with self.assertRaises(SystemExit) as raised:
            choose_engine(False, None)
        self.assertIn("pip install ocrmac", str(raised.exception))
        self.assertNotIn("paddlepaddle", str(raised.exception))
        text = score_vision(
            [
                ("bottom", 0.9, (0.1, 0.1, 0.2, 0.05)),
                ("top", 0.9, (0.1, 0.8, 0.2, 0.05)),
            ]
        )[1]
        self.assertEqual(text, "top\nbottom")

    def test_email_suffix_is_not_the_printed_address(self) -> None:
        self.assertIsNone(printed_email("shao@superpowertech.com", "cyshao@superpowertech.com"))
        self.assertEqual(printed_email("cyshao@superpowertech.com", "cyshao@superpowertech.com"), "cyshao@superpowertech.com")

    def test_superpower_fields_come_from_the_ocr_text(self) -> None:
        fields = apply_model_fields(classify_locally(SUPER), None, SUPER)
        self.assertIn("超力源", fields["name_zh"])
        self.assertIn("Superpower", fields["name_en"])
        self.assertEqual(fields["contact_name"], "邵春雨")
        self.assertEqual(fields["contact_title"], "业务经理")
        self.assertEqual(fields["phone"], "18575217885")
        self.assertEqual(fields["email"], "cyshao@superpowertech.com")
        self.assertTrue(any("superpowertech.com" in site for site in fields["websites"]))
        self.assertTrue(any("sz-supower.com.cn" in site for site in fields["websites"]))
        rejected = apply_model_fields(
            classify_locally(SUPER),
            {"phone": "19900001111", "website": "https://example.com", "email": "nobody@example.com"},
            SUPER,
        )
        self.assertEqual(rejected["phone"], "18575217885")
        self.assertNotIn("example.com", rejected["website"] or "")
        self.assertEqual(rejected["email"], "cyshao@superpowertech.com")
        swapped = apply_model_fields(classify_locally(SUPER), {"name_zh": "邵春雨", "name_en": "SuperPower"}, SUPER)
        self.assertIn("公司", swapped["name_zh"])
        self.assertIn("Co", swapped["name_en"])
        self.assertEqual(swapped["contact_name"], "邵春雨")

    def test_yeeda_fields_come_from_the_ocr_text(self) -> None:
        fields = apply_model_fields(classify_locally(YEEDA), None, YEEDA)
        self.assertIn("怡达", fields["name_zh"])
        self.assertIn("Yeeda", fields["name_en"])
        self.assertEqual(fields["contact_name"], "朱丹萍")
        self.assertEqual(fields["contact_title"], "销售经理")
        self.assertEqual(fields["phone"], "18068009705")
        self.assertIn("金浦路11号", fields["address"])
        self.assertIn("凤北荡路168号", fields["address"])
        self.assertIn("dingtalk.com", fields["email"])
        self.assertEqual(fields["website"], None)


if __name__ == "__main__":
    unittest.main()

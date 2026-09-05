import io
import json
import os
import re
import time

from google import genai
from google.genai import errors
from google.genai import types
from PIL import Image

import logger  # noqa: F401 — configures loguru on import
from loguru import logger as log

GEMINI_MODEL = "gemini-3.6-flash"
GEMINI_MAX_ATTEMPTS = max(1, int(os.getenv("GEMINI_MAX_ATTEMPTS", "3")))
GEMINI_RETRY_DELAY = max(0.0, float(os.getenv("GEMINI_RETRY_DELAY", "1.0")))

TASK_PROMPTS: dict[str, str] = {
    "caption": "Describe this image in a single, concise sentence.",
    "detailed_caption": (
        "Provide a detailed description of this image covering the main subjects, "
        "background, colors, composition, and notable details."
    ),
    "more_detailed_caption": (
        "Give an exhaustive description of every element in this image: objects, people, "
        "text, colors, lighting, spatial relationships, mood, and context."
    ),
    "object_detection": (
        "Detect all visible objects in this image.\n"
        "Return ONLY a valid JSON array — no markdown, no explanation.\n"
        'Format: [{"label": "object name", "box_2d": [y_min, x_min, y_max, x_max]}, ...]\n'
        "Coordinates are integers normalized 0–1000."
    ),
    "ocr": (
        "Extract every piece of text visible in this image. "
        "Preserve original layout and line breaks. Return only the extracted text."
    ),
    "scene_analysis": (
        "Perform a comprehensive scene analysis covering:\n"
        "1. Overall scene and setting\n"
        "2. Main subjects and their attributes\n"
        "3. Background and environment\n"
        "4. Notable objects, text, or symbols\n"
        "5. Lighting, colors, and mood\n"
        "6. Any inferred context or activity"
    ),
}


class VisionModel:
    def __init__(self) -> None:
        self._client: genai.Client | None = None

    def load(self, api_key: str) -> None:
        if self._client is not None:
            return
        log.info(f"Initializing Gemini client | model={GEMINI_MODEL}")
        self._client = genai.Client(api_key=api_key)
        log.success(f"Gemini client ready | model={GEMINI_MODEL}")

    def analyze(self, image: Image.Image, task: str) -> dict:
        prompt = TASK_PROMPTS.get(task, TASK_PROMPTS["caption"])
        log.info(f"Inference start | task={task} | image={image.width}x{image.height}")

        buf = io.BytesIO()
        image.save(buf, format="JPEG", quality=90)
        image_bytes = buf.getvalue()
        image_part = types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")

        t0 = time.perf_counter()
        response = self._generate_content([image_part, prompt])
        elapsed = time.perf_counter() - t0
        text = response.text.strip()

        log.info(
            f"Inference done | task={task} | duration={elapsed:.2f}s "
            f"| output_chars={len(text)}"
        )
        log.debug(f"Raw response | task={task} | text={text[:200]!r}")

        if task == "object_detection":
            result = self._parse_bboxes(text, image.width, image.height)
            n = len(result.get("<OD>", {}).get("bboxes", []))
            log.info(f"Object detection | found={n} objects")
            return result

        task_key = f"<{task.upper()}>"
        return {task_key: text}

    def chat(self, image: Image.Image, message: str, history: list[dict[str, str]]) -> str:
        buf = io.BytesIO()
        image.save(buf, format="JPEG", quality=90)
        image_part = types.Part.from_bytes(data=buf.getvalue(), mime_type="image/jpeg")

        transcript = "\n".join(
            f"{item['role'].title()}: {item['content']}"
            for item in history[-10:]
            if item.get("role") in {"user", "assistant"} and item.get("content")
        )
        prompt = (
            "You are Vision Analyst, a helpful multimodal image-analysis assistant. "
            "Use the image as the source of truth, be precise about uncertainty, and "
            "answer the user's question directly. You may describe objects, read visible "
            "text, explain spatial relationships, and discuss safety or accessibility. "
            "Do not claim to identify people or infer sensitive personal traits.\n\n"
            f"Conversation so far:\n{transcript or '(none)'}\n\n"
            f"User's new question: {message.strip()}"
        )

        response = self._generate_content([image_part, prompt])
        return response.text.strip()

    def _generate_content(self, contents: list) -> object:
        for attempt in range(GEMINI_MAX_ATTEMPTS):
            try:
                return self._client.models.generate_content(
                    model=GEMINI_MODEL,
                    contents=contents,
                )
            except errors.ServerError as exc:
                status_code = getattr(exc, "status_code", getattr(exc, "code", None))
                if status_code not in {500, 502, 503, 504} or attempt == GEMINI_MAX_ATTEMPTS - 1:
                    raise
                delay = GEMINI_RETRY_DELAY * (2 ** attempt)
                log.warning(
                    f"Gemini temporarily unavailable | status={status_code} "
                    f"| retry={attempt + 1}/{GEMINI_MAX_ATTEMPTS - 1} | delay={delay:.1f}s"
                )
                time.sleep(delay)

    def _parse_bboxes(self, text: str, img_w: int, img_h: int) -> dict:
        cleaned = re.sub(r"```(?:json)?|```", "", text).strip()
        try:
            objects = json.loads(cleaned)
        except json.JSONDecodeError:
            log.warning(f"Failed to parse bbox JSON | raw={text[:200]!r}")
            return {"<OD>": {"bboxes": [], "labels": [], "raw": text}}

        bboxes, labels = [], []
        for obj in objects:
            box = obj.get("box_2d", [])
            if len(box) == 4:
                y1, x1, y2, x2 = box
                # Convert 0-1000 normalized coords → pixel coords as [x1, y1, x2, y2]
                bboxes.append([
                    round(x1 * img_w / 1000),
                    round(y1 * img_h / 1000),
                    round(x2 * img_w / 1000),
                    round(y2 * img_h / 1000),
                ])
                labels.append(obj.get("label", "object"))

        return {"<OD>": {"bboxes": bboxes, "labels": labels}}


vision_model = VisionModel()

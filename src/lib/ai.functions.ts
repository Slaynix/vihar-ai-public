import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TextInput = z.object({ prompt: z.string().min(1).max(8000), model: z.enum(["flash", "pro"]).default("flash") });

async function generate(prompt: string, model: "flash" | "pro", system?: string) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const gateway = createLovableAiGatewayProvider(key);
  const modelId = model === "pro" ? "google/gemini-2.5-pro" : "google/gemini-3-flash-preview";
  const { text } = await generateText({ model: gateway(modelId), system, prompt });
  return text;
}

export const generateNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TextInput.parse(d))
  .handler(async ({ data }) =>
    generate(
      `Generate clear, structured study notes on this topic. Use markdown headings, bullet points, key formulas, and a short summary at the end.\n\nTopic: ${data.prompt}`,
      data.model,
      "You are an expert tutor. Produce high-quality, exam-ready notes.",
    ),
  );

export const generateRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TextInput.parse(d))
  .handler(async ({ data }) =>
    generate(
      `Build a step-by-step learning roadmap to achieve: ${data.prompt}\n\nReturn 6-10 phases. For each phase: title, duration, 3-5 concrete actions, and one milestone.`,
      data.model,
      "You are a career strategist for students. Output crisp markdown.",
    ),
  );

export const explainCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        code: z.string().min(1).max(8000),
        mode: z.enum(["explain", "fix", "optimize"]).default("explain"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const intent =
      data.mode === "fix"
        ? "Find and fix bugs. Return corrected code in a fenced block, then a short bullet list of what was wrong."
        : data.mode === "optimize"
          ? "Optimize this code for clarity and performance. Return improved code, then bullet list of changes."
          : "Explain this code step-by-step in simple terms. Highlight tricky parts.";
    return generate(`${intent}\n\n\`\`\`\n${data.code}\n\`\`\``, "flash", "You are a senior software engineer mentoring a student.");
  });

export const planMyWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ context: z.string().max(4000).default("") }).parse(d))
  .handler(async ({ data }) =>
    generate(
      `Given this student's current load: ${data.context || "general semester load"}, propose a focused 7-day study plan. For each day list 3-4 time-boxed tasks with priority (high/medium/low) and estimated minutes.`,
      "flash",
      "You are a productivity coach. Be realistic and motivating.",
    ),
  );

export const suggestInternships = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ skills: z.string().min(1).max(1000), domain: z.string().max(200).default("") }).parse(d),
  )
  .handler(async ({ data }) =>
    generate(
      `Suggest 8 internships a student could realistically apply to based on skills: ${data.skills}${data.domain ? ` in domain: ${data.domain}` : ""}.\nFor each: company type, role title, why it fits, 3 keywords to search.`,
      "flash",
      "You are a placement advisor.",
    ),
  );

export const interviewQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ company: z.string().min(1).max(200), role: z.string().max(200).default("SDE Intern") }).parse(d))
  .handler(async ({ data }) =>
    generate(
      `Generate 10 likely interview questions for ${data.role} at ${data.company}. Mix DSA, system design (light), behavioral, and company-specific. After each, add a 2-line hint.`,
      "flash",
      "You are a placement prep mentor.",
    ),
  );

export const dailyChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ difficulty: z.enum(["easy", "medium", "hard"]).default("medium"), topic: z.string().max(120).default("") }).parse(d),
  )
  .handler(async ({ data }) =>
    generate(
      `Create ONE ${data.difficulty} coding challenge${data.topic ? ` about ${data.topic}` : ""} for an engineering student.\nFormat exactly:\n# <Title>\n**Topic:** <topic> · **Difficulty:** ${data.difficulty}\n\n<problem statement, 3-5 lines>\n\n**Example**\ninput / output example in a fenced block.\n\n**Constraints**\n- bullets\nDo NOT give the solution.`,
      "flash",
      "You are a DSA coach. Be concise and precise.",
    ),
  );

export const codingHint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        problem: z.string().min(1).max(6000),
        code: z.string().max(6000).default(""),
        mode: z.enum(["hint", "review"]).default("hint"),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    data.mode === "hint"
      ? generate(
          `Problem:\n${data.problem}\n\nGive 3 progressive hints (nudge → approach → data structure). Never reveal full code.`,
          "flash",
          "You are a DSA coach. Short bullets only.",
        )
      : generate(
          `Problem:\n${data.problem}\n\nStudent solution:\n\`\`\`\n${data.code}\n\`\`\`\n\nReview it: correctness, time/space complexity, 3 concrete improvements. Keep it under 200 words.`,
          "flash",
          "You are a senior engineer reviewing student code.",
        ),
  );

export const recommendResources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ subject: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) =>
    generate(
      `Recommend the best free learning resources for the engineering subject "${data.subject}".\nGroup as: Docs, YouTube playlists, GitHub repos, NPTEL/SWAYAM courses, Cheat sheets. 2-3 items each with a one-line reason and a real URL.`,
      "flash",
      "You are a study-resource curator. Only suggest well-known, real resources.",
    ),
  );

export const dailyMissionsAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ context: z.string().max(2000).default("") }).parse(d))
  .handler(async ({ data }) => {
    const text = await generate(
      `Student activity snapshot: ${data.context || "no recent activity"}.\nGenerate exactly 3 daily missions. Return ONLY a JSON array, no prose:\n[{"title":"...","detail":"one short line","xp":20}]\nxp between 15 and 60. Titles under 60 chars, action-oriented.`,
      "flash",
      "You output raw JSON only.",
    );
    const match = text.match(/\[[\s\S]*\]/);
    try {
      const parsed = JSON.parse(match ? match[0] : text) as { title: string; detail?: string; xp?: number }[];
      return parsed.slice(0, 3).map((m) => ({ title: String(m.title).slice(0, 120), detail: m.detail ? String(m.detail).slice(0, 200) : "", xp: Math.min(60, Math.max(15, Number(m.xp) || 20)) }));
    } catch {
      return [
        { title: "Complete one 25-minute focus session", detail: "Deep work beats long distracted hours.", xp: 20 },
        { title: "Solve today's coding challenge", detail: "Consistency compounds.", xp: 30 },
        { title: "Review notes for your weakest subject", detail: "15 minutes is enough to move the needle.", xp: 20 },
      ];
    }
  });

export const studentInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ summary: z.string().min(1).max(4000) }).parse(d))
  .handler(async ({ data }) =>
    generate(
      `Student data:\n${data.summary}\n\nRespond in markdown with these exact sections, 1-2 lines each:\n**Predicted CGPA**\n**Weak areas**\n**Exam readiness**\n**Next best action**\nBe specific and motivating. No preamble.`,
      "flash",
      "You are an academic performance analyst for engineering students.",
    ),
  );


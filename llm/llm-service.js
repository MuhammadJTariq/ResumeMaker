class LLMService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || "";
    this.model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    this.baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async generateText({ input, instructions = "", model }) {
    if (!this.isConfigured()) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    const targetModel = model || this.model;
    const response = await fetch(`${this.baseUrl}/${targetModel}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: instructions
          ? {
              parts: [{ text: instructions }],
            }
          : undefined,
        contents: [
          {
            parts: [{ text: input }],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Gemini request failed.");
    }

    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim() || "";

    return {
      id: data.responseId || null,
      text,
      raw: data,
    };
  }

  async generateResumeSummary(resume) {
    const prompt = [
      "Create a concise professional summary for a resume.",
      "Use only the information provided.",
      "Keep it to 4 to 5 sentences.",
      "Do not invent experience, education, or achievements.",
      "",
      `Name: ${resume.personal.firstName} ${resume.personal.lastName}`,
      `Location: ${resume.personal.cityCountry}`,
      `Email: ${resume.personal.email}`,
      `Experience: ${resume.experience
        .map((item) => `${item.title} at ${item.subtitle}: ${item.description}`)
        .join(" | ")}`,
      `Education: ${resume.education
        .map((item) => `${item.degreeType} in ${item.title} at ${item.address}`)
        .join(" | ")}`,
      `Skills: ${resume.skills.join(", ")}`,
    ].join("\n");

    return this.generateText({
      instructions: "You write accurate professional resume summaries.",
      input: prompt,
    });
  }
}

module.exports = LLMService;

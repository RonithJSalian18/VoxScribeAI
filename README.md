# 🎙️ VoxScribe AI

VoxScribe AI is a full-stack AI application that transforms any YouTube video into a high-quality, SEO-optimized blog post. Using a multi-agent workflow and Retrieval-Augmented Generation (RAG), VoxScribe doesn't just summarize—it analyzes your past writing via a "Brand Voice Vault" to ensure the generated content sounds exactly like you.

---

## ✨ Features

* **Multi-Agent Pipeline:** Built with LangGraph, utilizing specialized AI agents (Researcher, Writer, and Editor) to systematically process transcripts and draft content.
* **Brand Voice Vault (RAG):** Upload PDFs of your previous writing. The system uses HuggingFace embeddings and Supabase pgvector to analyze your style and mimic your exact tone and vocabulary.
* **YouTube Transcript Extraction:** Automatically pulls and processes transcripts from standard YouTube URLs.
* **Secure User Authentication:** Full user sign-up and login flow powered by Supabase Auth.
* **Modern UI/UX:** Responsive, premium interface built with Next.js, Tailwind CSS, and Lucide icons.

---

## 🛠️ Tech Stack

| Category | Technologies |
| :--- | :--- |
| **Frontend** | Next.js (App Router, React), Tailwind CSS, Supabase Auth |
| **Backend** | FastAPI (Python), LangGraph, LangChain, Groq API (Llama 3.1 8B), HuggingFace Inference API, PyMuPDF, YouTube Transcript API |
| **Database** | Supabase (PostgreSQL with pgvector for vector similarity search) |

---

## 🚀 Local Setup

Follow these steps to run VoxScribe AI on your local machine.

### 1. Prerequisites

* Node.js (v18+)
* Python (3.11 or 3.12 recommended)
* A Supabase project (with pgvector enabled)
* API Keys for Groq and HuggingFace

### 2. Clone the Repository

```bash
git clone [https://github.com/your-username/VoxScribeAI.git](https://github.com/your-username/VoxScribeAI.git)
cd VoxScribeAI
```

### 3. Backend Setup (FastAPI)

Navigate to the backend directory and set up your Python environment:

```bash
cd voxscribe-backend
python -m venv .venv
```

Activate the virtual environment:

```bash
# On Windows:
.venv\Scripts\activate

# On Mac/Linux:
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a `.env` file in the `voxscribe-backend` folder and add your secret API keys:

```env
SUPABASE_URL=your_supabase_project_url_here
SUPABASE_SERVICE_KEY=your_supabase_service_role_key_here
GROQ_API_KEY=your_groq_api_key_here
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
```

Start the backend server:

```bash
uvicorn main:app --reload
```
> The API will run at http://localhost:8000

### 4. Frontend Setup (Next.js)

Open a new terminal window, navigate to the root directory, and install dependencies:

```bash
npm install
```

Create a `.env.local` file in the root directory for your public Supabase keys:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

Start the frontend development server:

```bash
npm run dev
```
> The web app will run at http://localhost:3000

---

## ☁️ Deployment

This project is configured for cloud deployment:

* **Backend:** Designed to be deployed on Render as a Python Web Service. Ensure your Build Command is `pip install --upgrade pip setuptools wheel && pip install -r voxscribe-backend/requirements.txt` and remember to add your API keys to Render's Environment Variables dashboard.
* **Frontend:** Designed for one-click deployment on Vercel. Be sure to update your API fetch URLs in Next.js from `localhost:8000` to your live Render URL before deploying.

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

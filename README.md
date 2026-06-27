VoxScribe

VoxScribe is a full-stack application that converts YouTube video transcripts into formatted blog posts. It utilizes a multi-agent architecture and Retrieval-Augmented Generation (RAG) to analyze uploaded writing samples, allowing the generated content to adapt to a specific writing style or tone.

Features

Multi-Agent Architecture: Uses LangGraph to orchestrate specialized nodes (Researcher, Writer, and Editor) to process transcripts and draft content systematically.

Style Analysis (RAG): Supports PDF uploads to create a reference knowledge base. Uses HuggingFace embeddings and Supabase pgvector to retrieve and reference specific writing styles.

Transcript Processing: Extracts and processes transcripts directly from standard YouTube URLs.

Authentication: User sign-up and session management handled via Supabase Auth.

User Interface: Responsive frontend built with Next.js and Tailwind CSS.

Tech Stack

Frontend:

Next.js (App Router, React)

Tailwind CSS

Supabase Auth

Backend:

FastAPI (Python Web Server)

LangGraph & LangChain (Agent Orchestration)

Groq API (Llama 3.1 8B)

HuggingFace Inference API (Embeddings)

PyMuPDF & YouTube Transcript API (Data Extraction)

Database:

Supabase (PostgreSQL with pgvector)

Local Setup

Follow these steps to run the application in a local development environment.

1. Prerequisites

Node.js (v18+)

Python (3.11 or 3.12 recommended)

A Supabase project (with pgvector enabled)

API Keys for Groq and HuggingFace

2. Clone the Repository

git clone [https://github.com/your-username/VoxScribeAI.git](https://github.com/your-username/VoxScribeAI.git)
cd VoxScribeAI


3. Backend Setup (FastAPI)

Navigate to the backend directory and configure the Python virtual environment:

cd voxscribe-backend
python -m venv .venv

# Activate the virtual environment
# On Windows:
.venv\Scripts\activate
# On Mac/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt


Create a .env file in the voxscribe-backend directory and add your environment variables:

SUPABASE_URL=your_supabase_project_url_here
SUPABASE_SERVICE_KEY=your_supabase_service_role_key_here
GROQ_API_KEY=your_groq_api_key_here
HUGGINGFACE_API_KEY=your_huggingface_api_key_here


Start the backend development server:

uvicorn main:app --reload


The API will be available at http://localhost:8000

4. Frontend Setup (Next.js)

Open a new terminal window, navigate to the root directory, and install the Node dependencies:

npm install


Create a .env.local file in the root directory for the public client variables:

NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here


Start the frontend development server:

npm run dev


The web interface will be available at http://localhost:3000

Deployment

The repository is structured for standard cloud deployment environments:

Backend: Configured for deployment as a Python Web Service (e.g., Render). Use the build command pip install --upgrade pip setuptools wheel && pip install -r voxscribe-backend/requirements.txt. Ensure all API keys from the .env file are added to the provider's environment variables settings.

Frontend: Configured for Node.js hosting (e.g., Vercel). Update the backend fetch URLs in the Next.js source code from localhost:8000 to the production backend URL before deploying.

Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss the proposed modifications.

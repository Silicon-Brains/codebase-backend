/**
 * Seed content for the public CMS tables. Kept separate from seed.ts so the
 * data can be imported by tests/tools without needing Supabase credentials.
 *
 * `projects.metrics` is an ORDERED ARRAY of { value, label } (not a keyed
 * object) because the UI renders them in order as "<value> <label>".
 */

export const services = [
  {
    slug: "full-stack-web-applications",
    title: "Full-Stack Web Applications",
    icon: "layout-dashboard",
    category: "Full-Stack Web",
    tag: "Distributed Systems",
    description:
      "Enterprise-grade web platforms engineered with modern reactivity, high throughput, and rock-solid relational or document databases. Built to process massive transaction volumes with minimal latency.",
    features: [
      "Single-Page & SSR Apps (Next.js/React)",
      "High-Throughput REST & GraphQL APIs",
      "Complex Admin & Ops Dashboards",
      "Real-Time WebSocket & State Sync",
    ],
    deliverables: [
      "Custom UI/UX Design Specifications & Systems",
      "Decoupled Microservices/Gateway Architecture",
      "Automated Continuous Integration/Deployment Pipeline",
      "Contractual 99.9% Production Uptime SLA",
    ],
    architecture_baseline: ["React", "Next.js", "Node.js", "Express", "PostgreSQL", "Redis"],
    metric_label: "Throughput Efficiency",
    metric_value: "48.2k req/sec",
    sort_order: 1,
  },
  {
    slug: "native-hybrid-android-solutions",
    title: "Native & Hybrid Android Solutions",
    icon: "smartphone",
    category: "Android & Hybrid",
    tag: "Edge Client Engineering",
    description:
      "Ergonomic, battery-conscious Android applications built for fluid performance, hardware integration, and offline-first data resilience across dynamic cellular environments.",
    features: [
      "Native Kotlin & Declarative Jetpack Compose",
      "Offline SQLite / Room Sync Architecture",
      "Biometrics & On-Device Sensor Delivery",
      "Resilient Push & Background WorkManagers",
    ],
    deliverables: [
      "Full Play Store Release & Multi-Bundle Management",
      "Multi-tier Device Fragmentation & OS Emulation Lab",
      "Battery Profiling & Thermal Load Optimization",
      "End-to-End Cryptographic Keystore Security Audit",
    ],
    architecture_baseline: ["Kotlin", "Jetpack Compose", "Coroutines", "Room DB", "Firebase", "Retrofit"],
    metric_label: "Frame Rate Target",
    metric_value: "120 FPS Jitter-Free",
    sort_order: 2,
  },
  {
    slug: "cloud-architecture-devops-sovereignty",
    title: "Cloud Architecture & DevOps Sovereignty",
    icon: "cloud-cog",
    category: "Cloud & DevOps",
    tag: "Infrastructure Resilience",
    description:
      "Scalable cloud infrastructure engineered for automated deployment, zero-downtime canary rollouts, and proactive sovereign security monitoring.",
    features: [
      "Docker & Containerized Orchestration",
      "Declarative Terraform Infrastructure as Code",
      "Serverless & Edge Compute Gateways",
      "Continuous Security Auditing & DDoS Mitigation",
    ],
    deliverables: [
      "Automated Multi-Region Failover Architecture",
      "Automated Staging & Production Deployment Guardrails",
      "Multi-Zone Live Database Replication & Snapshots",
      "Global CDN Route Latency Optimization",
    ],
    architecture_baseline: ["AWS", "Supabase", "Docker", "GitHub Actions", "MongoDB", "Cloudflare"],
    metric_label: "Auto-Healing Pipeline",
    metric_value: "Active Health Checks",
    sort_order: 3,
  },
  {
    slug: "applied-ai-intelligent-automation",
    title: "Applied AI & Intelligent Automation",
    icon: "brain-circuit",
    category: "AI & Machine Learning",
    tag: "Cognitive Engineering",
    description:
      "Integrating computer vision, predictive intelligence, and proprietary automation pipelines directly into business-critical operational workflows.",
    features: [
      "Computer Vision & Biometric Neural Models",
      "Automated OCR & Document Parsing at Scale",
      "LLM Autonomous Agent Pipelines & Vector RAG",
      "Edge Quantized Model Inference Execution",
    ],
    deliverables: [
      "Domain Fine-Tuning & Quantized Model Artifacts",
      "Secure Air-Gapped API/Inference Endpoints",
      "Vector Context Store & Dynamic Retrieval Indices",
      "24/7 Telemetry Real-Time Monitoring Dashboard",
    ],
    architecture_baseline: ["Python", "PyTorch", "OpenCV", "DeepFace", "FastAPI"],
    metric_label: "Inference Precision",
    metric_value: "99.4% F1-Score",
    sort_order: 4,
  },
];

export const projects = [
  {
    slug: "gympro",
    title: "GymPro — Enterprise Fitness & Operations Intelligence",
    summary:
      "A multi-location fitness ERP and member intelligence platform handling biometric turnstile sync, recurring automated billing, live floor capacity, and real-time revenue analytics.",
    category: "Full-Stack Web",
    tag: "Full-Stack Web & IoT",
    highlights: [
      "Real-Time Edge Sync: Biometric turnstiles connected over encrypted resilient WebSockets.",
      "Sub-15ms GraphQL: Tailored query response caching for structured isolated Redis clusters.",
      "Stripe Engine: High-throughput automated billing for 14,000+ recurring memberships.",
    ],
    tech_stack: ["React 18", "Node.js", "PostgreSQL", "Redis", "Docker", "GraphQL"],
    metrics: [
      { value: "+340%", label: "Retention Gain" },
      { value: "48.2k", label: "Tx / Day" },
      { value: "99.9%", label: "Uptime SLA" },
    ],
    featured: true,
    sort_order: 1,
  },
  {
    slug: "lifeline",
    title: "Lifeline — Sovereign Emergency Blood Donor Network",
    summary:
      "Peer-to-peer critical blood donation routing platform connecting emergency hospital wards, registered donors, and dispatch squads with live radius geofencing.",
    category: "Android & Mobile",
    tag: "Native Android & Real-time Geo",
    highlights: [],
    tech_stack: ["Kotlin", "Jetpack Compose", "Room DB", "WebSockets"],
    metrics: [
      { value: "<90s", label: "Dispatch Latency" },
      { value: "12,000+", label: "Active Donors" },
      { value: "100%", label: "Zero Packet Drop" },
    ],
    featured: false,
    sort_order: 2,
  },
  {
    slug: "face-analyzer",
    title: "Face Analyzer — Biometric Landmark & Emotion Engine",
    summary:
      "High-throughput edge vision system executing 68-point facial landmark geometry, real-time emotion telemetry, and liveness verification for access control.",
    category: "AI & Computer Vision",
    tag: "Applied AI & Computer Vision",
    highlights: [],
    tech_stack: ["Python", "PyTorch", "OpenCV", "ONNX", "FastAPI"],
    metrics: [
      { value: "99.4%", label: "Precision" },
      { value: "42ms", label: "Inference Rate" },
      { value: "0 Bytes", label: "Data Leak" },
    ],
    featured: false,
    sort_order: 3,
  },
  {
    slug: "internship-management",
    title: "Internship & Talent Management Cloud",
    summary:
      "Automated applicant lifecycle, structured peer-review grading engine, and cohort telemetry dashboard for university partnerships.",
    category: "Enterprise Systems",
    tag: "Enterprise Workflow & SSR",
    highlights: [],
    tech_stack: ["Next.js", "TypeScript", "PostgreSQL", "Supabase", "Tailwind"],
    metrics: [
      { value: "1,200+", label: "Candidates" },
      { value: "-85%", label: "Admin Workload" },
      { value: "100%", label: "Audit Trail" },
    ],
    featured: false,
    sort_order: 4,
  },
];

export const faqs = [
  {
    page: "contact",
    sort_order: 1,
    question: "What happens after I submit this inquiry?",
    answer:
      "Our pipeline is three-fold: First, a Principal Solutions Architect (not a sales rep) evaluates your specs within 24 hours. Second, we host a focused 30-minute discovery call to iron out system bottlenecks and scope boundaries. Third, within 48 hours of that call, you receive a complete architectural breakdown, timeline milestone map, and deterministic cost proposal.",
  },
  {
    page: "contact",
    sort_order: 2,
    question: "Can SiliconBrains sign our company's NDA before we share proprietary specs?",
    answer:
      "Yes — we will counter-sign your standard mutual NDA, or supply our own sovereign confidentiality terms before any technical deep-dive begins.",
  },
  {
    page: "contact",
    sort_order: 3,
    question: "How do your billing and engagement models work?",
    answer:
      "We offer dedicated engineering squads, fixed-scope project delivery, and architecture/code audits — each with milestone-gated, transparent billing and no hidden retainer surprises.",
  },
  {
    page: "contact",
    sort_order: 4,
    question: "Do we retain full intellectual property (IP) and source code ownership?",
    answer:
      "Always. 100% of source code, infrastructure credentials, and documentation transfer to you on Day One with zero vendor lock-in.",
  },
  {
    page: "contact",
    sort_order: 5,
    question: "Can you embed directly into our existing in-house engineering team?",
    answer:
      "Yes — our engineers integrate into your Slack, Jira, and existing sprint cadence as a dedicated extension of your team.",
  },
];

export const processSteps = [
  {
    phase_number: 1,
    title: "Discover & Feasibility Analysis",
    subtitle: "Week 1",
    description:
      "Before writing a single line of production code, we deconstruct your operational maze, map system nodes, stress-test competitive/architectural moats, and validate external integrations.",
    core_focus: [
      "System requirements decomposition & scope journey mapping",
      "Third-party API, integration & DevSEC(EX) feasibility validation",
      "Technology stack architecture validation (PostgreSQL, Go/Node, Kotlin/Next.js)",
    ],
    key_deliverables: ["Feasibility Radar (PRD SPEC)"],
    artifact_label: "Feasibility Radar",
    artifact_note: "PRD SPEC",
    quality_gate: "Architecture Alignment Sign-Off",
  },
  {
    phase_number: 2,
    title: "Plan & System Architecture Blueprint",
    subtitle: "Week 2",
    description:
      "We design the structural nervous system: relational schemas, microservice topologies, contract-first API definitions, and deterministic sprint roadmaps.",
    core_focus: [
      "Advanced ERD & relational schema mapping",
      "Layer-API & Specifications (OpenAPI/GraphQL Signature)",
      "Cloud infrastructure topology sizing (containerization/serverless)",
      "Milestone timeline & deterministic sprint scaffolding",
    ],
    key_deliverables: ["Topology Map (Terraform v1.5)"],
    artifact_label: "Topology Map",
    artifact_note: "Terraform v1.5",
    quality_gate: "Zero-Ambiguity Contract Freeze",
  },
  {
    phase_number: 3,
    title: "UI/UX Design & Tokenized Systems",
    subtitle: "Week 3-4",
    description:
      "We craft a pixel-precise visual and interaction language. Strict token systems, reusable Flutter/React component libraries, and tactile motion guidelines accompanying every screen.",
    core_focus: [
      "High-fidelity clickable visual mockups & UI ratification",
      "Design token library governance & accessibility compliance",
      "MOAS-Accessibility & contrast compliance",
      "Micro-animations, state transitions, and hardware-adaptive layouts",
    ],
    key_deliverables: ["Design System"],
    artifact_label: "Design System",
    artifact_note: null,
    quality_gate: "Client Visual & Interaction Approval",
  },
  {
    phase_number: 4,
    title: "Agile Development & Continuous QA",
    subtitle: "Week 5-N",
    description:
      "Disciplined engineering execution. Two-week sprints powered by automated test harnesses, trunk-based development, and non-negotiable code reviews.",
    core_focus: [
      "Test-driven development with rigid test coverage",
      "Isolated feature branching & principal budget code reviews",
      "Continuous automated regression, staging & load testing pipelines",
    ],
    key_deliverables: ["CI/CD Pipeline"],
    artifact_label: "CI/CD Pipeline",
    artifact_note: null,
    quality_gate: "Passing Automated Security & Lint Gates",
  },
  {
    phase_number: 5,
    title: "Hardened Launch & 30-Day Hypercare",
    subtitle: "Release + 30D",
    description:
      "Flawless production launch with zero downtime. Post-launch systems are monitored with 24/7 uptime tracking and hardened for full operational sovereignty.",
    core_focus: [
      "Blue/Green zero-downtime & live DNS cutover",
      "Google Play Store production launch and listing & App Catalog",
      "Intensive 30-day hypercare monitoring handoff & full operational sovereignty",
    ],
    key_deliverables: ["Uptime Telemetry"],
    artifact_label: "Uptime Telemetry",
    artifact_note: null,
    quality_gate: "Production BLA & Handover Certificate",
  },
];

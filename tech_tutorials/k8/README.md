# ☸️ Kubernetes Track (`tech_tutorials/k8`)

An end-to-end interactive curriculum and production reference manual suite for Kubernetes.

Live portal: [**https://lgtkgtv.github.io/pub/tech_tutorials/k8/**](https://lgtkgtv.github.io/pub/tech_tutorials/k8/)

---

## 📚 Published Interactive Tutorials

| # | Tutorial | Format | Highlights | Live Link |
|---|:---|:---:|:---|:---:|
| **01** | **Kubernetes, Step by Step** | Interactive Deck | 200 slides, dual perspectives (operator/developer/security), checkpoint quizzes, control plane & workloads. | [**Launch Deck**](https://lgtkgtv.github.io/pub/tech_tutorials/k8/step-by-step.html) |
| **02** | **Securing Kubernetes in Production** | Field Manual | 9 hardened modules, CIS Benchmark, interactive security posture audit dashboard, Labs 0–5 hands-on validation. | [**Open Manual**](https://lgtkgtv.github.io/pub/tech_tutorials/k8/security-field-manual.html) |
| **03** | **Training AI Models on Kubernetes** | Interactive Deck | GPU topology & DRA, batch scheduling (Kueue, Volcano), Kubeflow Trainer v2, NCCL fabrics, and startup blueprints. | [**Launch AI Deck**](https://lgtkgtv.github.io/pub/tech_tutorials/k8/ai-training.html) |

---

## 🔗 Learning Sequence

1. **Foundations**: Walk through [`step-by-step.html`](step-by-step.html) to understand the declarative reconciliation loop, controllers, storage, and networking.
2. **Hardening**: Run through [`security-field-manual.html`](security-field-manual.html) for zero-trust RBAC, NetworkPolicies, Pod Security Standards, and hands-on validation labs (Labs 0–5).
3. **AI Infrastructure**: Explore [`ai-training.html`](ai-training.html) to scale distributed deep learning workloads (PyTorch DDP/FSDP) on multi-GPU Kubernetes clusters.

---

## ⚡ Offline Viewing Support

All tutorials in this track are fully bundled for offline operation:
* **Zero External Script Dependencies**: Runtime styling (`vendor/tailwindcss.js`) and Markdown parsing (`vendor/marked.min.js`) are vendored locally.
* **Local Filesystem Compatible**: Can be opened directly via `file:///` in any browser without an internet connection or local web server.
* **Service Worker Enabled**: Integrated PWA service worker (`sw.js`) automatically caches assets when visited online for subsequent offline reading on mobile or laptop.

---

<sub>sachin godse - <a href="mailto:lgtkgtv@gmail.com">lgtkgtv@gmail.com</a></sub>

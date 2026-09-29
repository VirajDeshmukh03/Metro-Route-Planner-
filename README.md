# Personalized Multi-Criteria Metro Route Planner Using Dynamic Graph Optimization
### Data Structures Course Project (DS CP) — Mid-Semester Implementation (60% Milestone)

---

## 🚀 Quick Start Instructions

### 1. Run the Web Dashboard (Recommended for Mid-Sem Demo)
1. Simply double-click **`index.html`** in this folder to open it in **Google Chrome** or **Microsoft Edge**.
2. No internet connection, server setup, or npm installation is required. Everything runs locally in your browser.

### 2. Run the C++ Console Program (If the Professor asks to see C++)
A pre-compiled binary is already built in the `cpp/` folder:
```powershell
# In PowerShell or Command Prompt:
.\cpp\metro_planner.exe
```
Or to recompile from source with GCC / MinGW:
```powershell
g++ -std=c++11 -O2 cpp\main.cpp -o cpp\metro_planner.exe
.\cpp\metro_planner.exe
```

---



---

## 📂 Project Directory Structure

```text
Data Structures CP/
│
├── index.html                       # Modern Web Dashboard
├── style.css                        # Transit Dark Theme Styling
├── app.js                           # UI & Map Controller
│
├── data/
│   └── metroData.js                 # Metro network topology & station definitions
│
├── ds/
│   ├── priorityQueue.js             # Binary Min-Heap Priority Queue
│   ├── queue.js                     # FIFO Queue for BFS
│   └── graph.js                     # MetroGraph class (Adjacency List, Dijkstra, BFS)
│
├── cpp/
│   ├── main.cpp                     # Full C++ implementation
│   └── metro_planner.exe            # Pre-compiled executable
│
└── README.md                        # Quick start instructions
```



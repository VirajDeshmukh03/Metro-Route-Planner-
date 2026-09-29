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

## 🎯 Mid-Sem Demo Steps (Click-and-Show)

In the web dashboard, use the **Mid-Sem Demo Presets** located on the left panel:

1. **Preset 1 (Baseline Route)**:
   - Selects `PCMC` ➔ `Ramwadi` with `⚡ Fastest`.
   - Explains: *Dijkstra's Algorithm using Min-Heap Priority Queue on Travel Time*.
2. **Preset 2 (Dynamic Station Closure)**:
   - Closes the central hub `Civil Court`.
   - Explains: *Graph marks vertex inactive in O(1); Dijkstra automatically finds the detour via Shivajinagar-Ruby Hall connector*.
3. **Preset 3 (Track Delay Simulation)**:
   - Simulates a +15 min signal delay on the Khadki-Shivajinagar track.
   - Explains: *Edge weight update in dynamic graph*.
4. **Data Structures Inspector Tabs (Bottom of Page)**:
   - **Tab 1: Adjacency List**: Shows the in-memory graph representation.
   - **Tab 2: Hash Map**: Test station search (e.g. type `Shivajinagar` to show $O(1)$ key-to-ID lookup).
   - **Tab 3: Execution Trace**: Step-by-step min-heap extractions and queue visits.
   - **Tab 4: Multi-Criteria Comparison Table**: Side-by-side comparison of all 5 criteria.

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
├── MIDSEM_VIVA_PREPARATION_GUIDE.md # Complete viva preparation guide (13 concepts + Q&A)
├── PROJECT_REPORT_60PCT.md          # Formal mid-sem review report
└── README.md                        # Quick start instructions
```

---

## 📖 Viva Preparation
Read **`MIDSEM_VIVA_PREPARATION_GUIDE.md`** before tomorrow's review. It has simple answers to the 13 core questions, code walkthroughs, and 15 expected professor questions!

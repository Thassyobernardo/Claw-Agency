import logging
import time
from typing import TypedDict, List, Annotated, Sequence
from langgraph.graph import StateGraph, END

# Define the shared state for our agency
class AgencyState(TypedDict):
    # Current stage name
    current_node: str
    # Results from various agents to be shared across the chain
    results: dict
    # Any critical errors that should stop the cycle
    errors: List[str]
    # Detailed logs per node
    node_logs: List[str]

log = logging.getLogger(__name__)

def create_agency_graph():
    from scrapers import upwork_scraper
    import manager_agent
    import sales_agent
    import support_agent

    # 1. Define nodes
    def scanner_node(state: AgencyState):
        log.info("--- [Orchestrator] Scanner Agent ---")
        try:
            count = upwork_scraper.scrape()
            return {
                "current_node": "scanner",
                "results": {"new_leads_found": count},
                "node_logs": [f"Scanner found {count} leads."]
            }
        except Exception as e:
            return {"errors": [f"Scanner error: {str(e)}"]}

    def manager_node(state: AgencyState):
        log.info("--- [Orchestrator] Manager Agent ---")
        try:
            result = manager_agent.run_manager_cycle()
            return {
                "current_node": "manager",
                "results": {"manager_result": result},
                "node_logs": [f"Manager processed {result.get('processed', 0)} leads."]
            }
        except Exception as e:
            return {"errors": [f"Manager error: {str(e)}"]}

    def gatekeeper_node(state: AgencyState):
        """
        Verification layer (Skill: autonomous-agent-patterns).
        Checks if the previous node (Manager) actually produced work.
        If 0 leads were qualified, we might want to alert or stop.
        """
        log.info("--- [Orchestrator] Gatekeeper (Verifier) ---")
        results = state.get("results", {})
        manager_stats = results.get("manager_result", {})
        
        qualified = manager_stats.get("qualified", 0)
        errors = state.get("errors", [])
        
        if errors:
            log.warning(f"Gatekeeper: Detected {len(errors)} errors. Investigating...")
            return {"current_node": "gatekeeper", "node_logs": ["Gatekeeper flagged errors."]}
            
        if qualified == 0:
            log.info("Gatekeeper: No leads qualified in this cycle. Sales might skip.")
            return {"current_node": "gatekeeper", "node_logs": ["Gatekeeper: 0 leads qualified."]}
            
        return {
            "current_node": "gatekeeper",
            "node_logs": [f"Gatekeeper verified {qualified} qualified leads."]
        }

    def sales_node(state: AgencyState):
        log.info("--- [Orchestrator] Sales Agent ---")
        try:
            count = sales_agent.run_sales_cycle()
            return {
                "current_node": "sales",
                "results": {"sent_emails": count},
                "node_logs": [f"Sales dispatched {count} emails."]
            }
        except Exception as e:
            return {"errors": [f"Sales error: {str(e)}"]}

    def support_node(state: AgencyState):
        log.info("--- [Orchestrator] Support Agent ---")
        try:
            count = support_agent.run_support_cycle()
            return {
                "current_node": "support",
                "results": {"delivered_zips": count},
                "node_logs": [f"Support delivered {count} ZIPs."]
            }
        except Exception as e:
            return {"errors": [f"Support error: {str(e)}"]}

    # 2. Build the graph with conditional logic
    workflow = StateGraph(AgencyState)

    workflow.add_node("scanner", scanner_node)
    workflow.add_node("manager", manager_node)
    workflow.add_node("gatekeeper", gatekeeper_node)
    workflow.add_node("sales", sales_node)
    workflow.add_node("support", support_node)

    # 3. Define edges
    workflow.set_entry_point("scanner")
    workflow.add_edge("scanner", "manager")
    workflow.add_edge("manager", "gatekeeper")
    workflow.add_edge("gatekeeper", "sales")
    workflow.add_edge("sales", "support")
    workflow.add_edge("support", END)

    return workflow.compile()

# Singleton for the agency app
_agency_app = None

def get_agency_app():
    global _agency_app
    if _agency_app is None:
        _agency_app = create_agency_graph()
    return _agency_app

def run_full_agency_cycle():
    """Trigger one full multi-agent cycle via LangGraph."""
    app = get_agency_app()
    initial_state = {
        "current_node": "start",
        "results": {},
        "errors": [],
        "node_logs": ["Initiating complex agency cycle..."]
    }
    log.info("Running LangGraph Agency flow...")
    return app.invoke(initial_state)

import { inboxItems } from "../data/mockData";
import { EventTable } from "../components/tables/EventTable";

export function EventInboxPage() {
  return <EventTable items={inboxItems} />;
}

import { ActionPanel, Color, Icon, List, OpenInBrowserAction, preferences, showToast, ToastStyle } from "@raycast/api";
import useSWR from "swr";
import { formatDistance, fromUnixTime } from "date-fns";
import axios from "axios";

interface OrgResponse {
  name: string;
}

interface AlertResponse {
  alerts: AlertResponseItem[];
}

interface AlertResponseItem {
  id: string;
  status: "OK" | "CRITICAL" | "WARNING" | "UNKNOWN";
  monitorId: string;
  type: string;
  openedAt: number;
  closedAt?: number;
  value?: number;
  hostId?: string;
  message?: string;
  reason?: string;
}

export default function Command() {
  const apiKey = preferences.apiKey.value as string | undefined;
  const mackerel = axios.create({
    baseURL: "https://api.mackerelio.com",
    headers: {
      "X-Api-Key": String(apiKey),
    },
  });
  mackerel.interceptors.response.use(undefined, (error) => {
    return Promise.reject(`${error.config.url}: ${error.response.data.error}`);
  });

  const { data: orgName, error: orgError } = useSWR(apiKey, async () => {
    const response = await mackerel.get<OrgResponse>("/api/v0/org");
    return response.data.name;
  });

  const { data, error } = useSWR(orgName, async (orgName) => {
    const response = await mackerel.get<AlertResponse>("/api/v0/alerts");
    return response.data;
  });

  if (orgError) {
    showToast(ToastStyle.Failure, orgError);
  }
  if (error) {
    showToast(ToastStyle.Failure, error);
  }

  const isLoading = !data && !error && !orgError;

  return (
    <List isLoading={isLoading}>
      {orgName && data?.alerts.map((alert) => <AlertListItem key={alert.id} orgName={orgName} alert={alert} />)}
    </List>
  );
}

const AlertListItem = ({ orgName, alert }: { orgName: string; alert: AlertResponseItem }) => (
  <List.Item
    title={`${alert.type}: ${alert.message || alert.hostId || alert.value}`}
    subtitle={formatDistance(fromUnixTime(alert.openedAt), new Date(), { addSuffix: true })}
    actions={
      <ActionPanel>
        <OpenInBrowserAction url={`https://mackerel.io/orgs/${orgName}/alerts/${alert.id}`}></OpenInBrowserAction>
      </ActionPanel>
    }
    icon={{
      source: Icon.Circle,
      tintColor:
        alert.status === "OK"
          ? Color.Green
          : alert.status === "CRITICAL"
          ? Color.Red
          : alert.status === "WARNING"
          ? Color.Yellow
          : Color.SecondaryText,
    }}
  ></List.Item>
);

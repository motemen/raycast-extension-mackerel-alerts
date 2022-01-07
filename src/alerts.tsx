import { ActionPanel, Color, Icon, List, OpenInBrowserAction, preferences, showToast, ToastStyle } from "@raycast/api";
import useSWR from "swr";
import { formatDistance, fromUnixTime } from "date-fns";
import axios from "axios";

// https://mackerel.io/ja/api-docs/entry/organizations#get
interface OrgResponse {
  name: string;
}

// https://mackerel.io/ja/api-docs/entry/alerts#get
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
  const apiKey = preferences.apiKey?.value as string | undefined;

  const { data, error } = useSWR(apiKey, async (apiKey) => {
    const mackerel = axios.create({
      baseURL: "https://api.mackerelio.com",
      headers: {
        "X-Api-Key": apiKey,
      },
    });
    mackerel.interceptors.response.use(undefined, (error) => {
      return Promise.reject(`${error.config.url}: ${error.response.data.error}`);
    });

    const { data: orgResponse } = await mackerel.get<OrgResponse>("/api/v0/org");
    const { data: alertsResponse } = await mackerel.get<AlertResponse>("/api/v0/alerts");

    return {
      orgName: orgResponse.name,
      alerts: alertsResponse.alerts,
    };
  });

  if (error) {
    showToast(ToastStyle.Failure, error);
  }

  return (
    <List isLoading={!data && !error}>
      {data?.alerts.map((alert) => (
        <AlertListItem key={alert.id} orgName={data.orgName} alert={alert} />
      ))}
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
      tintColor: {
        OK: Color.Green,
        CRITICAL: Color.Red,
        WARNING: Color.Yellow,
        UNKNOWN: Color.SecondaryText,
      }[alert.status],
    }}
  ></List.Item>
);

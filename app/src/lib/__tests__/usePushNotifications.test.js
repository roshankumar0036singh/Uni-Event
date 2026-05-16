import React from "react";

import {
  render,
  waitFor,
} from "@testing-library/react-native";

import { Text } from "react-native";

import {
  usePushNotifications,
} from "../usePushNotifications";

import * as Notifications
  from "expo-notifications";

import * as Device
  from "expo-device";

jest.mock("expo-device", () => ({
  isDevice: true,
}));

jest.mock("expo-constants", () => ({
  expoConfig: {
    extra: {
      eas: {
        projectId: "test-project-id",
      },
    },
  },
}));

jest.mock("expo-notifications", () => ({

  setNotificationHandler: jest.fn(),

  setNotificationChannelAsync: jest.fn(),

  getPermissionsAsync: jest.fn(),

  requestPermissionsAsync: jest.fn(),

  getExpoPushTokenAsync: jest.fn(),

  addNotificationReceivedListener: jest.fn(),

  addNotificationResponseReceivedListener:
    jest.fn(),

  removeNotificationSubscription: jest.fn(),

  AndroidImportance: {
    MAX: "MAX",
  },

}));

const TestComponent = () => {

  const {
    expoPushToken,
  } = usePushNotifications();

  return (
    <Text testID="token">
      {expoPushToken}
    </Text>
  );
};

describe("usePushNotifications", () => {

  beforeEach(() => {

    jest
      .spyOn(console, "log")
      .mockImplementation(() => {});

    Notifications.getPermissionsAsync
      .mockResolvedValue({
        status: "granted",
      });

    Notifications.getExpoPushTokenAsync
      .mockResolvedValue({
        data: "expo-token-123",
      });

    Notifications.addNotificationReceivedListener
      .mockReturnValue("notification-listener");

    Notifications
      .addNotificationResponseReceivedListener
      .mockReturnValue("response-listener");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("registers and returns expo push token", async () => {

    const { getByTestId } = render(
      <TestComponent />
    );

    await waitFor(() => {

      expect(
        getByTestId("token").props.children
      ).toBe("expo-token-123");

    });
  });

  test("requests permissions when not granted", async () => {

    Notifications.getPermissionsAsync
      .mockResolvedValueOnce({
        status: "denied",
      });

    Notifications.requestPermissionsAsync
      .mockResolvedValueOnce({
        status: "granted",
      });

    render(<TestComponent />);

    await waitFor(() => {

      expect(
        Notifications.requestPermissionsAsync
      ).toHaveBeenCalled();

    });
  });

  test("returns no token if permissions denied", async () => {

    Notifications.getPermissionsAsync
      .mockResolvedValueOnce({
        status: "denied",
      });

    Notifications.requestPermissionsAsync
      .mockResolvedValueOnce({
        status: "denied",
      });

    const { getByTestId } = render(
      <TestComponent />
    );

    await waitFor(() => {

      expect(
        getByTestId("token").props.children
      ).toBe("");

    });
  });

  test("handles non-device environment", async () => {

    Device.isDevice = false;

    const { getByTestId } = render(
      <TestComponent />
    );

    await waitFor(() => {

      expect(
        getByTestId("token").props.children
      ).toBe("");

    });

    Device.isDevice = true;
  });

});

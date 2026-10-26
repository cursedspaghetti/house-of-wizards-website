import { fireEvent, render, screen } from "@testing-library/react";
import { ZoomableArtwork } from "./ZoomableArtwork";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

test("supports zoom controls, keyboard reset and a bounded zoom range", () => {
  render(<ZoomableArtwork src="/art.webp" alt="A wizard" />);
  const region = screen.getByRole("region", { name: "Zoomable artwork" });
  expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  expect(screen.getByText("150%")).toBeInTheDocument();
  fireEvent.keyDown(region, { key: "Escape" });
  expect(screen.getByText("100%")).toBeInTheDocument();
  fireEvent.doubleClick(region);
  expect(screen.getByText("250%")).toBeInTheDocument();
  for (let i = 0; i < 10; i++) fireEvent.keyDown(region, { key: "+" });
  expect(screen.getByText("500%")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Fit image" }));
  expect(screen.getByText("100%")).toBeInTheDocument();
});

test("reset Escape stays inside the viewer; Escape at fit can close the parent", () => {
  const parentKey = jest.fn();
  render(
    // Test the key bubbling contract with the containing gallery.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div onKeyDown={parentKey}>
      <ZoomableArtwork src="/art.webp" alt="A wizard" />
    </div>,
  );
  const region = screen.getByRole("region");
  fireEvent.keyDown(region, { key: "+" });
  fireEvent.keyDown(region, { key: "Escape" });
  expect(parentKey).not.toHaveBeenCalled();
  fireEvent.keyDown(region, { key: "Escape" });
  expect(parentKey).toHaveBeenCalledTimes(1);
});

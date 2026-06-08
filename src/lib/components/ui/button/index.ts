import type { ComponentProps } from "svelte";
import Root from "./button.svelte";

type ButtonProps = ComponentProps<typeof Root>;
type ButtonVariant = ButtonProps["variant"];
type ButtonSize = ButtonProps["size"];

export {
	Root,
	type ButtonProps as Props,
	//
	Root as Button,
	type ButtonProps,
	type ButtonSize,
	type ButtonVariant
};

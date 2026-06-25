import {
  type IAppRouter,
  Plugin,
  type PluginManifest,
  toPlugin,
} from "@databricks/appkit";
import manifest from "./manifest.json";

export class HelloPlugin extends Plugin {
  static manifest = manifest as PluginManifest<"hello">;

  injectRoutes(router: IAppRouter): void {
    this.route(router, {
      name: "hello",
      method: "get",
      path: "/",
      handler: async (_req, res) => {
        res.json({ message: "Hello from the AppKit registry plugin!" });
      },
    });
  }
}

export const hello = toPlugin(HelloPlugin);

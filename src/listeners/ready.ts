import { container, Listener } from "@sapphire/framework";
import { Events, type ClientEvents } from "discord.js";
import { setupLogCapture } from "../lib/log-capture.js";

export class ReadyListener extends Listener<Events.ClientReady> {
  constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, once: true, event: Events.ClientReady });
  }

  override run(...[client]: ClientEvents[Events.ClientReady]) {
    // Setup log capture for dashboard integration
    setupLogCapture();

    container.logger.info("Connecté en tant que :", client.user.tag);
  }
}

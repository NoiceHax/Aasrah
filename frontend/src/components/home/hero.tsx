"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { routes } from "@/lib/routes";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-primary text-on-primary">
      {/* Ambient gradient + grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 60% at 75% 0%, rgba(70,72,212,0.35) 0%, rgba(9,20,38,0) 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <Container className="relative grid items-center gap-12 py-20 md:grid-cols-2 md:py-28">
        <div className="flex flex-col gap-6">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-label-sm text-secondary-fixed-dim"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            Live across 85 partner NGOs
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="text-display-lg leading-[1.05] tracking-tight md:text-[56px] md:leading-[1.05]"
          >
            Empowering Humanitarian Response
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="max-w-xl text-body-lg text-on-primary-container opacity-90"
          >
            Aasrah bridges the gap between people in need and organizations ready to help. We
            streamline emergency reporting and volunteer coordination for a more resilient
            community.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <Button href={routes.report} variant="success" size="lg" leadingIcon="report">
              Report a Person
            </Button>
            <Button
              href={routes.about}
              size="lg"
              className="border border-white/20 bg-white/5 text-on-primary hover:bg-white/10"
            >
              Partner with Us
            </Button>
          </motion.div>
        </div>

        {/* Floating status panel: glassmorphism over the navy band */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative"
        >
          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-glass shadow-raised-lg">
            {/*
              Illustrative, not live. The rows below are hand-written examples
              of what a coordinator's queue looks like — labelled as such,
              because presenting invented case IDs and NGO names as real
              activity is not something an NGO partner should have to discover
              by clicking. Wire this to /stats when there is live data worth
              showing.
            */}
            <div className="flex items-center justify-between">
              <span className="text-label-md font-semibold">Example response feed</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-label-sm text-on-primary-container">
                Illustrative
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { id: "#AR-9402", label: "Claimed by a partner NGO", state: "info", km: "1.2 km" },
                { id: "#AR-9398", label: "Responder en route", state: "success", km: "3.4 km" },
                { id: "#AR-9391", label: "Pending verification", state: "warning", km: "0.8 km" },
              ].map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3.5 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={
                        row.state === "success"
                          ? "h-2 w-2 rounded-full bg-success"
                          : row.state === "warning"
                            ? "h-2 w-2 rounded-full bg-warning"
                            : "h-2 w-2 rounded-full bg-secondary-fixed-dim"
                      }
                    />
                    <div className="flex flex-col">
                      <span className="text-label-md font-semibold">{row.id}</span>
                      <span className="text-label-sm text-on-primary-container opacity-80">
                        {row.label}
                      </span>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-label-sm text-on-primary-container opacity-80">
                    <Icon name="near_me" className="text-[16px]" />
                    {row.km}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg bg-secondary/30 px-3.5 py-3">
              <span className="text-label-sm">
                Sample cases shown for illustration. Live platform figures are below.
              </span>
            </div>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}

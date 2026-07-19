"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormSuccess } from "./form-success";
import { useForm, compose, required, email, minLength } from "@/lib/use-form";

type ContactValues = {
  name: string;
  email: string;
  topic: string;
  message: string;
};

const initial: ContactValues = { name: "", email: "", topic: "", message: "" };

const topicOptions = [
  { value: "partnership", label: "NGO partnership" },
  { value: "volunteering", label: "Volunteering" },
  { value: "press", label: "Press & media" },
  { value: "support", label: "Platform support" },
  { value: "other", label: "Something else" },
];

export function ContactForm() {
  const form = useForm<ContactValues>(initial, {
    name: required("Please enter your name"),
    email: compose(required("Email is required"), email()),
    topic: required("Select a topic"),
    message: compose(
      required("Please enter a message"),
      minLength(20, "A little more detail helps us route your message (at least 20 characters)"),
    ),
  });

  if (form.submitted) {
    return (
      <Card className="p-stack-lg">
        <FormSuccess
          title="Message sent"
          description="Thanks for reaching out. A member of our team will get back to you within one business day."
          onReset={form.reset}
          resetLabel="Send another message"
        />
      </Card>
    );
  }

  return (
    <Card className="p-stack-lg">
      <form noValidate onSubmit={form.handleSubmit(() => {})} className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            name="name"
            label="Name"
            required
            leadingIcon="person"
            placeholder="Your name"
            value={form.values.name}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.touched.name ? form.errors.name : undefined}
          />
          <Input
            name="email"
            label="Email"
            type="email"
            required
            leadingIcon="mail"
            placeholder="you@example.com"
            value={form.values.email}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.touched.email ? form.errors.email : undefined}
          />
        </div>

        <Select
          name="topic"
          label="Topic"
          required
          placeholder="What's this about?"
          options={topicOptions}
          value={form.values.topic}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.topic ? form.errors.topic : undefined}
        />

        <Textarea
          name="message"
          label="Message"
          required
          rows={5}
          placeholder="How can we help?"
          value={form.values.message}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.message ? form.errors.message : undefined}
        />

        <Button
          type="submit"
          size="lg"
          fullWidth
          leadingIcon={form.submitting ? undefined : "send"}
          disabled={form.submitting}
        >
          {form.submitting ? "Sending…" : "Send Message"}
        </Button>
      </form>
    </Card>
  );
}

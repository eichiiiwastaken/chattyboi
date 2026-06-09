import Form from "next/form";
import { redirect } from "next/navigation";

import { signOut } from "@/app/(auth)/auth";

export const SignOutForm = () => {
  return (
    <Form
      action={async () => {
        "use server";

        await signOut({
          redirect: false,
        });
        redirect("/");
      }}
      className="w-full"
    >
      <button
        className="w-full px-1 py-0.5 text-left text-red-500"
        type="submit"
      >
        Sign out
      </button>
    </Form>
  );
};

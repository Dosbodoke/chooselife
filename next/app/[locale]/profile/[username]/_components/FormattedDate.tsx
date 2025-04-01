import { useFormatter } from "next-intl";

interface Props {
  date: Date;
}

function FormatedDate({ date }: Props) {
  const format = useFormatter();
  return (
    <div className="text-sm text-gray-600 dark:text-gray-400">
      {format.dateTime(date, {
        dateStyle: "medium",
        timeStyle: "short",
      })}
    </div>
  );
}

export default FormatedDate;

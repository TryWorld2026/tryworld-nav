/**
 * 标题里的英文串不折行。
 *
 * 中文标题没有空格，浏览器可以在任何两个字符之间断行 —— 于是
 * 「OpenAI 发布 GPT-5.2」可能被排成「…GPT-」/「5.2」，模型名被切成两半；
 * 更糟的是「Llama-3.1-70B」这种本身就带连字符的型号，断行位置正好在
 * 连字符上，读起来像两个版本号。
 *
 * 做法是把「字母数字 + 连字符」的组合包进 `whitespace-nowrap` 的 `<span>`：
 * 只禁掉这些 token 内部的折行，中文部分照常自由断行，
 * 所以不会出现整行溢出或两端对齐的大洞。
 *
 * 只用于**标题**。正文段落里这么包会把行尾拉得很松，正文的换行交给
 * 浏览器自己的断行规则即可。
 */
export function HeadlineText({ text }: { text: string }) {
  // 捕获组让 `split` 保留分隔符：偶数位是普通文本，奇数位是英文 token。
  const parts = text.split(/([A-Za-z0-9]+(?:-[A-Za-z0-9]+)+)/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="whitespace-nowrap">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
